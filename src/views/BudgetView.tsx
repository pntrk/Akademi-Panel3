import React from 'react';
import { useAppContext } from '../context/AppContext';
import { generateId } from '../lib/utils';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  TrendingUp, 
  AlertTriangle, 
  ChevronDown, 
  ChevronRight, 
  CheckSquare, 
  Square, 
  MinusSquare,
  Sparkles,
  RefreshCw,
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Building2,
  Calendar,
  GraduationCap,
  Layers,
  CreditCard
} from 'lucide-react';

export const BudgetView = () => {
  const { state, updateBudget, setStudents } = useAppContext();
  const { incomes, expenses, debts } = state.budget;

  const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
  const remaining = totalIncome - totalExpense;

  // Selection states
  const [selectedIncomeIds, setSelectedIncomeIds] = React.useState<string[]>([]);
  const [selectedExpenseIds, setSelectedExpenseIds] = React.useState<string[]>([]);
  const [selectedDebtIds, setSelectedDebtIds] = React.useState<string[]>([]);
  const [selectedStudentDebtKeys, setSelectedStudentDebtKeys] = React.useState<string[]>([]);
  const [mobileBudgetTab, setMobileBudgetTab] = React.useState<'all' | 'incomes' | 'expenses' | 'debts'>('all');
  const [isMobileStatsOpen, setIsMobileStatsOpen] = React.useState(false);

  // Collapse/expand states for groups
  const [expandedIncomes, setExpandedIncomes] = React.useState<Record<string, boolean>>({});
  const [expandedExpenses, setExpandedExpenses] = React.useState<Record<string, boolean>>({});
  const [expandedStudentDebts, setExpandedStudentDebts] = React.useState<Record<string, boolean>>({});

  const toggleIncomeGroup = (examId: string) => {
    setExpandedIncomes(prev => ({ ...prev, [examId]: !prev[examId] }));
  };

  const toggleExpenseGroup = (publisherName: string) => {
    setExpandedExpenses(prev => ({ ...prev, [publisherName]: !prev[publisherName] }));
  };

  const toggleStudentDebtGroup = (examId: string) => {
    setExpandedStudentDebts(prev => ({ ...prev, [examId]: !prev[examId] }));
  };

  // Helper to detect if an item name matches any exam
  const findMatchingExam = React.useCallback((itemName: string) => {
    if (!itemName) return undefined;
    // Sort exams by name length descending to match longest possible exam name first
    const sortedExams = [...state.exams].sort((a, b) => b.name.length - a.name.length);
    return sortedExams.find(exam => itemName.toLowerCase().includes(exam.name.toLowerCase()));
  }, [state.exams]);

  // Dynamic student registrations that are unpaid
  const studentDebts = React.useMemo(() => {
    const list: Array<{ studentId: string; studentName: string; studentClass: string; examId: string; examName: string; fee: number; date: string }> = [];
    state.students.forEach(student => {
      (student.examRegistrations || []).forEach(reg => {
        if (!reg.isPaid && reg.fee > 0) {
          const examObj = state.exams.find(e => e.id === reg.examId);
          list.push({
            studentId: student.id,
            studentName: student.name,
            studentClass: student.className || '',
            examId: reg.examId,
            examName: examObj ? examObj.name : 'Sınav',
            fee: reg.fee,
            date: reg.dateRegistered || ''
          });
        }
      });
    });
    return list;
  }, [state.students, state.exams]);

  // Grouped Student Debts
  const groupedStudentDebts = React.useMemo(() => {
    const groups: Record<string, { examId: string; examName: string; totalFee: number; list: typeof studentDebts }> = {};
    studentDebts.forEach(debt => {
      if (!groups[debt.examId]) {
        groups[debt.examId] = {
          examId: debt.examId,
          examName: debt.examName,
          totalFee: 0,
          list: []
        };
      }
      groups[debt.examId].totalFee += debt.fee;
      groups[debt.examId].list.push(debt);
    });
    return Object.values(groups);
  }, [studentDebts]);

  // Grouped Incomes
  const groupedIncomes = React.useMemo(() => {
    const groups: Record<string, { examId: string; examName: string; totalAmount: number; items: typeof incomes }> = {};
    const ungrouped: typeof incomes = [];

    incomes.forEach(item => {
      const matchedExam = item.examId 
        ? state.exams.find(e => e.id === item.examId) 
        : findMatchingExam(item.name);
        
      if (matchedExam) {
        if (!groups[matchedExam.id]) {
          groups[matchedExam.id] = {
            examId: matchedExam.id,
            examName: matchedExam.name,
            totalAmount: 0,
            items: []
          };
        }
        groups[matchedExam.id].totalAmount += item.amount;
        groups[matchedExam.id].items.push(item);
      } else {
        ungrouped.push(item);
      }
    });

    return {
      examGroups: Object.values(groups),
      ungrouped
    };
  }, [incomes, state.exams, findMatchingExam]);

  // Grouped Expenses by Publisher
  const groupedExpenses = React.useMemo(() => {
    const groups: Record<string, { publisherName: string; totalAmount: number; items: typeof expenses }> = {};
    const ungrouped: typeof expenses = [];

    expenses.forEach(item => {
      const matchedExam = item.examId
        ? state.exams.find(e => e.id === item.examId)
        : findMatchingExam(item.name);
      const publisher = matchedExam?.publisher?.trim();

      if (publisher) {
        if (!groups[publisher]) {
          groups[publisher] = {
            publisherName: publisher,
            totalAmount: 0,
            items: []
          };
        }
        groups[publisher].totalAmount += item.amount;
        groups[publisher].items.push(item);
      } else {
        ungrouped.push(item);
      }
    });

    return {
      publisherGroups: Object.values(groups),
      ungrouped
    };
  }, [expenses, state.exams, findMatchingExam]);

  const totalCorporateDebt = debts.reduce((sum, item) => sum + item.amount, 0);
  const totalStudentDebt = studentDebts.reduce((sum, item) => sum + item.fee, 0);
  const totalDebt = totalCorporateDebt + totalStudentDebt;

  const handleAdd = (type: 'incomes' | 'expenses' | 'debts') => {
    const list = state.budget[type];
    const newItem = type === 'expenses' 
      ? { id: generateId(), no: list.length + 1, name: '', amount: 0 }
      : { id: generateId(), name: '', amount: 0 };
    updateBudget(type, [...list, newItem]);
  };

  const handleUpdate = (type: 'incomes' | 'expenses' | 'debts', id: string, field: string, value: any) => {
    const list = state.budget[type];
    const updated = list.map(item => item.id === id ? { ...item, [field]: value } : item);
    updateBudget(type, updated);
  };

  const handleRemove = (type: 'incomes' | 'expenses' | 'debts', id: string) => {
    const list = state.budget[type];
    updateBudget(type, list.filter(item => item.id !== id));
    
    // Clear selection if deleted
    if (type === 'incomes') setSelectedIncomeIds(prev => prev.filter(i => i !== id));
    if (type === 'expenses') setSelectedExpenseIds(prev => prev.filter(i => i !== id));
    if (type === 'debts') setSelectedDebtIds(prev => prev.filter(i => i !== id));
  };

  // Single Debt pay
  const handlePayDebt = (item: any) => {
    if (!item.name && !item.amount) return;
    
    const newExpense = {
      id: generateId(),
      no: expenses.length + 1,
      name: item.name ? `${item.name} (Ödenen Borç)` : "Ödenen Borç",
      amount: item.amount || 0
    };
    
    const newDebts = debts.filter(d => d.id !== item.id);
    
    updateBudget('expenses', [...expenses, newExpense]);
    updateBudget('debts', newDebts);
    setSelectedDebtIds(prev => prev.filter(id => id !== item.id));
  };

  // Single Student Debt collect
  const handleCollectStudentDebt = (item: typeof studentDebts[0]) => {
    const student = state.students.find(s => s.id === item.studentId);
    if (!student) return;

    // 1. Mark as paid in student's registration
    const updatedStudents = state.students.map(s => {
      if (s.id === item.studentId) {
        const regs = (s.examRegistrations || []).map(r => {
          if (r.examId === item.examId) {
            return { ...r, isPaid: true };
          }
          return r;
        });
        return { ...s, examRegistrations: regs };
      }
      return s;
    });
    setStudents(updatedStudents);

    // Clear key from selections
    const key = `${item.studentId}_${item.examId}`;
    setSelectedStudentDebtKeys(prev => prev.filter(k => k !== key));

    alert(`${item.studentName} isimli öğrenciden ₺${item.fee} kayıt ücreti tahsil edildi ve bütçe gelirlerine eklendi!`);
  };

  // --- Bulk Operation Handlers ---

  // Incomes Bulk Actions
  const toggleSelectAllIncomes = () => {
    const allIds = incomes.map(i => i.id);
    if (selectedIncomeIds.length === allIds.length) {
      setSelectedIncomeIds([]);
    } else {
      setSelectedIncomeIds(allIds);
    }
  };

  const toggleSelectIncomeGroup = (items: typeof incomes, event: React.MouseEvent) => {
    event.stopPropagation();
    const itemIds = items.map(i => i.id);
    const allSelected = itemIds.every(id => selectedIncomeIds.includes(id));
    
    if (allSelected) {
      setSelectedIncomeIds(prev => prev.filter(id => !itemIds.includes(id)));
    } else {
      setSelectedIncomeIds(prev => {
        const next = [...prev];
        itemIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const handleBulkDeleteIncomes = () => {
    if (selectedIncomeIds.length === 0) return;
    if (confirm(`Seçili ${selectedIncomeIds.length} gelir kalemini silmek istediğinize emin misiniz?`)) {
      const updated = incomes.filter(item => !selectedIncomeIds.includes(item.id));
      updateBudget('incomes', updated);
      setSelectedIncomeIds([]);
    }
  };

  // Expenses Bulk Actions
  const toggleSelectAllExpenses = () => {
    const allIds = expenses.map(e => e.id);
    if (selectedExpenseIds.length === allIds.length) {
      setSelectedExpenseIds([]);
    } else {
      setSelectedExpenseIds(allIds);
    }
  };

  const toggleSelectExpenseGroup = (items: typeof expenses, event: React.MouseEvent) => {
    event.stopPropagation();
    const itemIds = items.map(i => i.id);
    const allSelected = itemIds.every(id => selectedExpenseIds.includes(id));
    
    if (allSelected) {
      setSelectedExpenseIds(prev => prev.filter(id => !itemIds.includes(id)));
    } else {
      setSelectedExpenseIds(prev => {
        const next = [...prev];
        itemIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const handleBulkDeleteExpenses = () => {
    if (selectedExpenseIds.length === 0) return;
    if (confirm(`Seçili ${selectedExpenseIds.length} harcama kalemini silmek istediğinize emin misiniz?`)) {
      const updated = expenses.filter(item => !selectedExpenseIds.includes(item.id));
      updateBudget('expenses', updated);
      setSelectedExpenseIds([]);
    }
  };

  // Corporate Debts Bulk Actions
  const toggleSelectAllDebts = () => {
    const allIds = debts.map(d => d.id);
    if (selectedDebtIds.length === allIds.length) {
      setSelectedDebtIds([]);
    } else {
      setSelectedDebtIds(allIds);
    }
  };

  const handleBulkDeleteDebts = () => {
    if (selectedDebtIds.length === 0) return;
    if (confirm(`Seçili ${selectedDebtIds.length} borç kalemini silmek istediğinize emin misiniz?`)) {
      const updated = debts.filter(item => !selectedDebtIds.includes(item.id));
      updateBudget('debts', updated);
      setSelectedDebtIds([]);
    }
  };

  const handleBulkPayDebts = () => {
    if (selectedDebtIds.length === 0) return;
    const debtsToPay = debts.filter(d => selectedDebtIds.includes(d.id));
    const validDebts = debtsToPay.filter(d => d.name || d.amount);
    
    if (validDebts.length === 0) return;

    if (confirm(`Seçili ${validDebts.length} borç ödemesini gerçekleştirip harcamalara aktarmak istiyor musunuz?`)) {
      const newExpenses = validDebts.map((item, idx) => ({
        id: generateId(),
        no: expenses.length + idx + 1,
        name: item.name ? `${item.name} (Ödenen Borç)` : "Ödenen Borç",
        amount: item.amount || 0
      }));

      const remainingDebts = debts.filter(d => !selectedDebtIds.includes(d.id));

      updateBudget('expenses', [...expenses, ...newExpenses]);
      updateBudget('debts', remainingDebts);
      setSelectedDebtIds([]);
      
      alert(`Seçili ${validDebts.length} borç ödenerek harcama kalemlerine aktarıldı!`);
    }
  };

  // Student Debts Bulk Actions
  const toggleSelectAllStudentDebts = () => {
    const allKeys = studentDebts.map(d => `${d.studentId}_${d.examId}`);
    if (selectedStudentDebtKeys.length === allKeys.length) {
      setSelectedStudentDebtKeys([]);
    } else {
      setSelectedStudentDebtKeys(allKeys);
    }
  };

  const toggleSelectStudentDebtGroup = (list: typeof studentDebts, event: React.MouseEvent) => {
    event.stopPropagation();
    const itemKeys = list.map(d => `${d.studentId}_${d.examId}`);
    const allSelected = itemKeys.every(key => selectedStudentDebtKeys.includes(key));
    
    if (allSelected) {
      setSelectedStudentDebtKeys(prev => prev.filter(key => !itemKeys.includes(key)));
    } else {
      setSelectedStudentDebtKeys(prev => {
        const next = [...prev];
        itemKeys.forEach(key => {
          if (!next.includes(key)) next.push(key);
        });
        return next;
      });
    }
  };

  const handleBulkCollectStudentDebts = () => {
    if (selectedStudentDebtKeys.length === 0) return;

    const debtsToCollect = studentDebts.filter(d => 
      selectedStudentDebtKeys.includes(`${d.studentId}_${d.examId}`)
    );

    if (debtsToCollect.length === 0) return;

    if (confirm(`Seçili ${debtsToCollect.length} öğrenciden toplam ₺${debtsToCollect.reduce((sum, d) => sum + d.fee, 0)} kayıt ücreti tahsil etmek istediğinize emin misiniz?`)) {
      // 1. Mark registrations as paid in state
      const updatedStudents = state.students.map(s => {
        const studentSelectedDebts = debtsToCollect.filter(d => d.studentId === s.id);
        if (studentSelectedDebts.length > 0) {
          const examIds = studentSelectedDebts.map(d => d.examId);
          const regs = (s.examRegistrations || []).map(r => {
            if (examIds.includes(r.examId)) {
              return { ...r, isPaid: true };
            }
            return r;
          });
          return { ...s, examRegistrations: regs };
        }
        return s;
      });
      setStudents(updatedStudents);

      setSelectedStudentDebtKeys([]);
      alert(`Seçili ${debtsToCollect.length} öğrenciden toplam ₺${debtsToCollect.reduce((sum, d) => sum + d.fee, 0)} başarıyla tahsil edilerek bütçe gelirlerine entegre edildi!`);
    }
  };

  // Helper checkbox state checker for partial/all
  const isAllIncomesSelected = incomes.length > 0 && selectedIncomeIds.length === incomes.length;
  const isAnyIncomesSelected = selectedIncomeIds.length > 0;

  const isAllExpensesSelected = expenses.length > 0 && selectedExpenseIds.length === expenses.length;
  const isAnyExpensesSelected = selectedExpenseIds.length > 0;

  const isAllDebtsSelected = debts.length > 0 && selectedDebtIds.length === debts.length;
  const isAnyDebtsSelected = selectedDebtIds.length > 0;

  const isAllStudentDebtsSelected = studentDebts.length > 0 && selectedStudentDebtKeys.length === studentDebts.length;
  const isAnyStudentDebtsSelected = selectedStudentDebtKeys.length > 0;

  return (
    <div className="space-y-3 sm:space-y-5 flex flex-col h-full font-sans text-brand-ink">
      <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 sm:gap-4">
        <div className="w-full sm:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/15 text-emerald-700 flex items-center justify-center shrink-0 font-bold shadow-2xs">
                <Coins className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-serif text-brand-ink font-bold tracking-tight leading-tight">
                  Bütçe Takibi
                </h2>
                <p className="hidden sm:block text-brand-ink/60 text-xs mt-0.5">
                  Sınav ve yayın bazlı gruplanmış gelir, harcama, borç takibi ve finansal özet
                </p>
              </div>
            </div>
            <span className={`sm:hidden text-xs font-bold px-2.5 py-1 rounded-full border shadow-2xs ${
              remaining >= 0 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80' 
                : 'bg-rose-50 text-rose-800 border-rose-200/80'
            }`}>
              Net: ₺{(totalIncome - totalExpense).toLocaleString('tr-TR')}
            </span>
          </div>
        </div>

        {/* Mobile Quick Toggles & Active Segmented Control */}
        <div className="sm:hidden flex items-center justify-between w-full gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => setIsMobileStatsOpen(!isMobileStatsOpen)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs active:scale-95 ${
              isMobileStatsOpen 
                ? 'bg-brand-ink text-white border-brand-ink' 
                : 'bg-white text-brand-ink border-brand-border/80 hover:bg-[#FAF9F6]'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Finansal Özet</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isMobileStatsOpen ? 'rotate-180' : ''}`} />
          </button>

          <div className="flex items-center bg-[#F5F4F0] p-1 rounded-xl border border-brand-border/70 gap-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setMobileBudgetTab('all')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all active:scale-95 ${
                mobileBudgetTab === 'all'
                  ? 'bg-white text-brand-ink shadow-2xs'
                  : 'text-brand-ink/60 hover:text-brand-ink'
              }`}
            >
              Tümü
            </button>
            <button
              type="button"
              onClick={() => setMobileBudgetTab('incomes')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all active:scale-95 ${
                mobileBudgetTab === 'incomes'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              Gelir
            </button>
            <button
              type="button"
              onClick={() => setMobileBudgetTab('expenses')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all active:scale-95 ${
                mobileBudgetTab === 'expenses'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-rose-700 hover:text-rose-900'
              }`}
            >
              Gider
            </button>
            <button
              type="button"
              onClick={() => setMobileBudgetTab('debts')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all active:scale-95 ${
                mobileBudgetTab === 'debts'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-amber-700 hover:text-amber-900'
              }`}
            >
              Borç
            </button>
          </div>
        </div>
        
        {/* Top Summary Cards (Collapsible on mobile, always visible on desktop) */}
        <div className={`${isMobileStatsOpen ? 'grid' : 'hidden'} sm:grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 w-full xl:w-auto shrink-0`}>
          <button 
            type="button"
            onClick={() => setMobileBudgetTab(prev => prev === 'incomes' ? 'all' : 'incomes')}
            className={`p-2.5 sm:p-3.5 rounded-2xl border flex flex-col justify-between text-left transition-all duration-200 cursor-pointer active:scale-[0.98] shadow-2xs ${
              mobileBudgetTab === 'incomes'
                ? 'bg-emerald-500/10 border-emerald-400 ring-2 ring-emerald-500/25'
                : 'bg-white hover:bg-emerald-50/30 border-brand-border/70 hover:border-emerald-300'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <ArrowDownLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-emerald-950/70 uppercase tracking-wider truncate">
                  Toplam Gelir
                </span>
              </div>
              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                mobileBudgetTab === 'incomes' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {mobileBudgetTab === 'incomes' ? 'Aktif' : `${incomes.length}`}
              </span>
            </div>
            <span className="text-base sm:text-xl font-bold font-sans tracking-tight text-emerald-700 mt-1.5 sm:mt-2">
              ₺{totalIncome.toLocaleString('tr-TR')}
            </span>
          </button>
          
          <button 
            type="button"
            onClick={() => setMobileBudgetTab(prev => prev === 'expenses' ? 'all' : 'expenses')}
            className={`p-2.5 sm:p-3.5 rounded-2xl border flex flex-col justify-between text-left transition-all duration-200 cursor-pointer active:scale-[0.98] shadow-2xs ${
              mobileBudgetTab === 'expenses'
                ? 'bg-rose-500/10 border-rose-400 ring-2 ring-rose-500/25'
                : 'bg-white hover:bg-rose-50/30 border-brand-border/70 hover:border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-rose-950/70 uppercase tracking-wider truncate">
                  Toplam Gider
                </span>
              </div>
              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                mobileBudgetTab === 'expenses' ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-800'
              }`}>
                {mobileBudgetTab === 'expenses' ? 'Aktif' : `${expenses.length}`}
              </span>
            </div>
            <span className="text-base sm:text-xl font-bold font-sans tracking-tight text-rose-700 mt-1.5 sm:mt-2">
              ₺{totalExpense.toLocaleString('tr-TR')}
            </span>
          </button>

          <button 
            type="button"
            onClick={() => setMobileBudgetTab(prev => prev === 'debts' ? 'all' : 'debts')}
            className={`p-2.5 sm:p-3.5 rounded-2xl border flex flex-col justify-between text-left transition-all duration-200 cursor-pointer active:scale-[0.98] shadow-2xs ${
              mobileBudgetTab === 'debts'
                ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-500/25'
                : 'bg-white hover:bg-amber-50/30 border-brand-border/70 hover:border-amber-300'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-amber-950/70 uppercase tracking-wider truncate">
                  Bekleyen Borç
                </span>
              </div>
              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                mobileBudgetTab === 'debts' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'
              }`}>
                {mobileBudgetTab === 'debts' ? 'Aktif' : `${debts.length + studentDebts.length}`}
              </span>
            </div>
            <span className="text-base sm:text-xl font-bold font-sans tracking-tight text-amber-700 mt-1.5 sm:mt-2">
              ₺{totalDebt.toLocaleString('tr-TR')}
            </span>
          </button>

          <button 
            type="button"
            onClick={() => setMobileBudgetTab('all')}
            className={`p-2.5 sm:p-3.5 rounded-2xl border flex flex-col justify-between text-left transition-all duration-200 cursor-pointer active:scale-[0.98] shadow-2xs ${
              remaining >= 0 
                ? 'bg-[#151618] text-white border-[#151618] hover:bg-[#222428]' 
                : 'bg-rose-900 text-white border-rose-900 hover:bg-rose-950'
            } ${mobileBudgetTab === 'all' ? 'ring-2 ring-brand-accent' : ''}`}
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  remaining >= 0 ? 'bg-white/10 text-emerald-400' : 'bg-white/10 text-rose-300'
                }`}>
                  <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold text-white/80 uppercase tracking-wider truncate">
                  Net Durum
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">
                {mobileBudgetTab === 'all' ? 'Tümü' : 'Görünüm'}
              </span>
            </div>
            <span className={`text-base sm:text-xl font-bold font-sans tracking-tight mt-1.5 sm:mt-2 ${
              remaining >= 0 ? 'text-emerald-300' : 'text-rose-200'
            }`}>
              ₺{remaining.toLocaleString('tr-TR')}
            </span>
          </button>
        </div>
      </header>

      {/* Desktop/Tablet Tab Switcher for Tablets/Laptops */}
      <div className="hidden sm:flex lg:hidden bg-[#F5F4F0] p-1.5 rounded-2xl border border-brand-border/70 gap-1.5 shrink-0 shadow-2xs">
        <button
          type="button"
          onClick={() => setMobileBudgetTab('all')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
            mobileBudgetTab === 'all'
              ? 'bg-white text-brand-ink shadow-xs'
              : 'text-brand-ink/60 hover:text-brand-ink hover:bg-white/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Tümü (Tam Görünüm)</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileBudgetTab('incomes')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
            mobileBudgetTab === 'incomes'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50'
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          <span>Gelirler</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            mobileBudgetTab === 'incomes' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {incomes.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileBudgetTab('expenses')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
            mobileBudgetTab === 'expenses'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-rose-800 hover:text-rose-950 hover:bg-rose-50'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Giderler</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            mobileBudgetTab === 'expenses' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
          }`}>
            {expenses.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileBudgetTab('debts')}
          className={`flex-1 py-2 px-3 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
            mobileBudgetTab === 'debts'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-amber-800 hover:text-amber-950 hover:bg-amber-50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Borçlar</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
            mobileBudgetTab === 'debts' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
          }`}>
            {debts.length + studentDebts.length}
          </span>
        </button>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-3xl p-3 sm:p-5 lg:p-6 shadow-xs border border-brand-border/70 flex-1 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 pb-6 pr-0.5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 xl:gap-8 h-full">
            
            {/* Gelir Sütunu */}
            <div className={`flex flex-col ${
              mobileBudgetTab === 'all' || mobileBudgetTab === 'incomes' ? 'flex' : 'hidden lg:flex'
            }`}>
              <div className="flex items-center justify-between mb-3 sm:mb-4 pb-2.5 border-b border-brand-border/70 shrink-0">
                <div className="flex items-center space-x-2.5">
                  {incomes.length > 0 && (
                    <input
                      type="checkbox"
                      checked={isAllIncomesSelected}
                      ref={el => {
                        if (el) {
                          el.indeterminate = isAnyIncomesSelected && !isAllIncomesSelected;
                        }
                      }}
                      onChange={toggleSelectAllIncomes}
                      className="w-4 h-4 rounded-md border-brand-border text-emerald-600 focus:ring-emerald-500 transition-colors cursor-pointer"
                    />
                  )}
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs sm:text-sm font-bold text-brand-ink uppercase tracking-wider">GELİR (TAHSİLATLAR)</h3>
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200/60">
                      {incomes.length}
                    </span>
                  </div>
                </div>
                {isAnyIncomesSelected && (
                  <button
                    onClick={handleBulkDeleteIncomes}
                    className="flex items-center space-x-1 text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 px-2.5 py-1 rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
                    title="Seçilen Gelirleri Toplu Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Toplu Sil ({selectedIncomeIds.length})</span>
                  </button>
                )}
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                 {/* Grouped Incomes by Exam */}
                 {groupedIncomes.examGroups.map(group => {
                   const isExpanded = !!expandedIncomes[group.examId];
                   const groupItemIds = group.items.map(i => i.id);
                   const isAllGroupSelected = groupItemIds.every(id => selectedIncomeIds.includes(id));
                   const isAnyGroupSelected = groupItemIds.some(id => selectedIncomeIds.includes(id));

                   return (
                     <div key={group.examId} className="border border-emerald-100 rounded-2xl overflow-hidden bg-white shadow-2xs transition-all hover:shadow-xs hover:border-emerald-200">
                       <div
                         onClick={() => toggleIncomeGroup(group.examId)}
                         className="flex items-center justify-between p-3 bg-emerald-50/50 hover:bg-emerald-100/50 cursor-pointer transition-colors"
                       >
                         <div className="flex items-center space-x-2.5 text-emerald-950 min-w-0">
                           <input
                             type="checkbox"
                             checked={isAllGroupSelected}
                             ref={el => {
                               if (el) el.indeterminate = isAnyGroupSelected && !isAllGroupSelected;
                             }}
                             onClick={(e) => e.stopPropagation()}
                             onChange={(e) => toggleSelectIncomeGroup(group.items, e as any)}
                             className="w-3.5 h-3.5 rounded-md border-emerald-300 text-emerald-600 focus:ring-emerald-500 transition-colors cursor-pointer shrink-0"
                           />
                           {isExpanded ? (
                             <ChevronDown className="w-4 h-4 text-emerald-700 shrink-0" />
                           ) : (
                             <ChevronRight className="w-4 h-4 text-emerald-700 shrink-0" />
                           )}
                           <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                           <span className="text-xs font-bold truncate">{group.examName} Gelirleri</span>
                           <span className="text-[10px] bg-emerald-100/90 text-emerald-800 px-2 py-0.5 rounded-full font-bold shrink-0">
                             {group.items.length} Kalem
                           </span>
                         </div>
                         <span className="text-sm font-bold text-emerald-800 shrink-0 ml-2">₺{group.totalAmount.toLocaleString('tr-TR')}</span>
                       </div>

                       {isExpanded && (
                         <div className="p-2 bg-emerald-50/20 border-t border-emerald-100 space-y-1.5 divide-y divide-emerald-100/60">
                           {group.items.map((item, index) => {
                             const isSelected = selectedIncomeIds.includes(item.id);
                             return (
                               <div key={item.id} className={`flex items-center group relative p-1.5 transition-all rounded-xl pl-8 ${isSelected ? 'bg-emerald-50/60 ring-1 ring-emerald-300' : 'hover:bg-white'}`}>
                                 <input
                                   type="checkbox"
                                   checked={isSelected}
                                   onChange={() => {
                                     setSelectedIncomeIds(prev =>
                                       prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                                     );
                                   }}
                                   className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-md border-brand-border text-emerald-600 focus:ring-emerald-500 transition-colors cursor-pointer"
                                 />
                                 <div className="w-5 text-center text-[10px] font-mono font-bold text-brand-ink/40 shrink-0">{index + 1}</div>
                                 <input
                                   type="text"
                                   value={item.name}
                                   onChange={e => handleUpdate('incomes', item.id, 'name', e.target.value)}
                                   className="flex-1 px-2 py-1 w-full min-w-0 text-xs font-medium text-brand-ink bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-emerald-500/30 rounded-lg border-none"
                                   placeholder="Gelir Kalemi"
                                 />
                                 <div className="font-bold text-emerald-800 flex items-center pr-1 shrink-0">
                                   <span className="text-xs">₺</span>
                                   <input
                                     type="number"
                                     value={item.amount || ''}
                                     onChange={e => handleUpdate('incomes', item.id, 'amount', parseInt(e.target.value) || 0)}
                                     className="w-16 sm:w-20 px-1 py-1 text-xs font-bold text-right bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-emerald-500/30 rounded-lg border-none"
                                   />
                                 </div>
                                 <button
                                   onClick={() => handleRemove('incomes', item.id)}
                                   className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-ink/40 hover:text-rose-600 hover:bg-rose-50 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0 cursor-pointer active:scale-95"
                                   title="Sil"
                                 >
                                   <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                               </div>
                             );
                           })}
                         </div>
                       )}
                     </div>
                   );
                 })}

                 {/* Ungrouped/Manual Incomes */}
                 {groupedIncomes.ungrouped.map((item, index) => {
                   const isSelected = selectedIncomeIds.includes(item.id);
                   return (
                     <div key={item.id} className={`flex items-center group rounded-xl p-2 border transition-all relative pl-9 ${isSelected ? 'bg-emerald-50/30 border-emerald-300 ring-1 ring-emerald-200' : 'bg-white border-brand-border/70 hover:border-emerald-300/80 shadow-2xs'}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedIncomeIds(prev =>
                              prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                            );
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-md border-brand-border text-emerald-600 focus:ring-emerald-500 transition-colors cursor-pointer"
                        />
                        <div className="w-5 text-center text-xs font-mono font-bold text-brand-ink/40 shrink-0">{index + 1}</div>
                        <input type="text" value={item.name} onChange={e => handleUpdate('incomes', item.id, 'name', e.target.value)} className="flex-1 min-w-0 px-2 py-1 text-xs sm:text-sm font-medium text-brand-ink bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-emerald-500/30 rounded-lg border-none" placeholder="Gelir Kalemi" />
                        <div className="font-bold text-emerald-800 flex items-center pr-1 shrink-0">
                          <span className="text-xs">₺</span>
                          <input type="number" value={item.amount || ''} onChange={e => handleUpdate('incomes', item.id, 'amount', parseInt(e.target.value)||0)} className="w-16 sm:w-20 px-1 py-1 text-xs sm:text-sm font-bold text-right bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-emerald-500/30 rounded-lg border-none" />
                        </div>
                        <button onClick={() => handleRemove('incomes', item.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-ink/40 hover:text-rose-600 hover:bg-rose-50 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0 cursor-pointer active:scale-95"><Trash2 className="w-3.5 h-3.5"/></button>
                     </div>
                   );
                 })}

                 <button onClick={() => handleAdd('incomes')} className="w-full flex items-center justify-center gap-1.5 py-2.5 sm:py-3 text-xs sm:text-sm text-brand-ink hover:text-black bg-[#FAF9F6] hover:bg-[#F2EFE9] font-bold rounded-xl border border-dashed border-brand-border hover:border-brand-accent/60 transition-all cursor-pointer active:scale-[0.99] mt-2.5 shadow-2xs">
                   <Plus className="w-4 h-4 text-emerald-700" />
                   <span>Gelir Kalemi Ekle</span>
                 </button>
              </div>
              
              <div className="mt-4 pt-3.5 pb-3 px-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100/90 flex justify-between items-center shrink-0 shadow-2xs">
                  <span className="text-xs font-bold text-emerald-950/70 uppercase tracking-wider">TOPLAM GELİR</span>
                  <span className="text-base sm:text-lg font-bold text-emerald-700 tabular-nums">₺{totalIncome.toLocaleString('tr-TR')}</span>
              </div>
            </div>

            {/* Gider Sütunu */}
            <div className={`flex flex-col ${
              mobileBudgetTab === 'all' || mobileBudgetTab === 'expenses' ? 'flex' : 'hidden lg:flex'
            }`}>
              <div className="flex items-center justify-between mb-3 sm:mb-4 pb-2.5 border-b border-brand-border/70 shrink-0">
                <div className="flex items-center space-x-2.5">
                  {expenses.length > 0 && (
                    <input
                      type="checkbox"
                      checked={isAllExpensesSelected}
                      ref={el => {
                        if (el) {
                          el.indeterminate = isAnyExpensesSelected && !isAllExpensesSelected;
                        }
                      }}
                      onChange={toggleSelectAllExpenses}
                      className="w-4 h-4 rounded-md border-brand-border text-rose-600 focus:ring-rose-500 transition-colors cursor-pointer"
                    />
                  )}
                  <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs sm:text-sm font-bold text-brand-ink uppercase tracking-wider">GİDER (HARCAMALAR)</h3>
                    <span className="text-[10px] bg-rose-50 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-200/60">
                      {expenses.length}
                    </span>
                  </div>
                </div>
                {isAnyExpensesSelected && (
                  <button
                    onClick={handleBulkDeleteExpenses}
                    className="flex items-center space-x-1 text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 px-2.5 py-1 rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
                    title="Seçilen Harcamaları Toplu Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Toplu Sil ({selectedExpenseIds.length})</span>
                  </button>
                )}
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                 {/* Grouped Publisher Expenses */}
                 {groupedExpenses.publisherGroups.map(group => {
                   const isExpanded = !!expandedExpenses[group.publisherName];
                   const groupItemIds = group.items.map(i => i.id);
                   const isAllGroupSelected = groupItemIds.every(id => selectedExpenseIds.includes(id));
                   const isAnyGroupSelected = groupItemIds.some(id => selectedExpenseIds.includes(id));

                   return (
                     <div key={group.publisherName} className="border border-amber-100/90 rounded-2xl overflow-hidden bg-white shadow-2xs transition-all hover:shadow-xs hover:border-amber-200">
                       <div
                         onClick={() => toggleExpenseGroup(group.publisherName)}
                         className="flex items-center justify-between p-3 bg-amber-50/60 hover:bg-amber-100/50 cursor-pointer transition-colors"
                       >
                         <div className="flex items-center space-x-2.5 text-amber-950 min-w-0">
                           <input
                             type="checkbox"
                             checked={isAllGroupSelected}
                             ref={el => {
                               if (el) el.indeterminate = isAnyGroupSelected && !isAllGroupSelected;
                             }}
                             onClick={(e) => e.stopPropagation()}
                             onChange={(e) => toggleSelectExpenseGroup(group.items, e as any)}
                             className="w-3.5 h-3.5 rounded-md border-amber-300 text-amber-700 focus:ring-amber-500 transition-colors cursor-pointer shrink-0"
                           />
                           {isExpanded ? (
                             <ChevronDown className="w-4 h-4 text-amber-700 shrink-0" />
                           ) : (
                             <ChevronRight className="w-4 h-4 text-amber-700 shrink-0" />
                           )}
                           <Building2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                           <span className="text-xs font-bold truncate">{group.publisherName} Harcamaları</span>
                           <span className="text-[10px] bg-amber-100/90 text-amber-800 px-2 py-0.5 rounded-full font-bold shrink-0">
                             {group.items.length} Kalem
                           </span>
                         </div>
                         <span className="text-sm font-bold text-amber-800 shrink-0 ml-2">₺{group.totalAmount.toLocaleString('tr-TR')}</span>
                       </div>

                       {isExpanded && (
                         <div className="p-2 bg-[#FCFBF7] border-t border-brand-border/70 space-y-1.5 divide-y divide-brand-border/40">
                           {group.items.map((item, index) => {
                             const isSelected = selectedExpenseIds.includes(item.id);
                             return (
                               <div key={item.id} className={`flex items-center group relative p-1.5 transition-all rounded-xl pl-8 ${isSelected ? 'bg-amber-50/40 ring-1 ring-amber-300' : 'hover:bg-white'}`}>
                                 <input
                                   type="checkbox"
                                   checked={isSelected}
                                   onChange={() => {
                                     setSelectedExpenseIds(prev =>
                                       prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                                     );
                                   }}
                                   className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-md border-brand-border text-rose-600 focus:ring-rose-500 transition-colors cursor-pointer"
                                 />
                                 <div className="w-5 text-center text-[10px] font-mono font-bold text-brand-ink/40 shrink-0">{index + 1}</div>
                                 <input
                                   type="text"
                                   value={item.name}
                                   onChange={e => handleUpdate('expenses', item.id, 'name', e.target.value)}
                                   className="flex-1 px-2 py-1 w-full min-w-0 text-xs font-medium text-brand-ink bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-rose-500/30 rounded-lg border-none"
                                   placeholder="Harcama Kalemi"
                                 />
                                 <div className="font-bold text-rose-800 flex items-center pr-1 shrink-0">
                                   <span className="text-xs">₺</span>
                                   <input
                                     type="number"
                                     value={item.amount || ''}
                                     onChange={e => handleUpdate('expenses', item.id, 'amount', parseInt(e.target.value) || 0)}
                                     className="w-16 sm:w-20 px-1 py-1 text-xs font-bold text-right bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-rose-500/30 rounded-lg border-none"
                                   />
                                 </div>
                                 <button
                                   onClick={() => handleRemove('expenses', item.id)}
                                   className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-ink/40 hover:text-rose-600 hover:bg-rose-50 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0 cursor-pointer active:scale-95"
                                   title="Sil"
                                 >
                                   <Trash2 className="w-3.5 h-3.5" />
                                 </button>
                               </div>
                             );
                           })}
                         </div>
                       )}
                     </div>
                   );
                 })}

                 {/* Ungrouped/Manual Expenses */}
                 {groupedExpenses.ungrouped.map((item, index) => {
                   const isSelected = selectedExpenseIds.includes(item.id);
                   return (
                     <div key={item.id} className={`flex items-center group rounded-xl p-2 border transition-all relative pl-9 ${isSelected ? 'bg-rose-50/30 border-rose-300 ring-1 ring-rose-200' : 'bg-white border-brand-border/70 hover:border-rose-300/80 shadow-2xs'}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedExpenseIds(prev =>
                              prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                            );
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-md border-brand-border text-rose-600 focus:ring-rose-500 transition-colors cursor-pointer"
                        />
                        <div className="w-5 text-center text-xs font-mono font-bold text-brand-ink/40 shrink-0">{index + 1}</div>
                        <input type="text" value={item.name} onChange={e => handleUpdate('expenses', item.id, 'name', e.target.value)} className="flex-1 min-w-0 px-2 py-1 text-xs sm:text-sm font-medium text-brand-ink bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-rose-500/30 rounded-lg border-none" placeholder="Harcama Kalemi" />
                        <div className="font-bold text-rose-800 flex items-center pr-1 shrink-0">
                          <span className="text-xs">₺</span>
                          <input type="number" value={item.amount || ''} onChange={e => handleUpdate('expenses', item.id, 'amount', parseInt(e.target.value)||0)} className="w-16 sm:w-20 px-1 py-1 text-xs sm:text-sm font-bold text-right bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-rose-500/30 rounded-lg border-none" />
                        </div>
                        <button onClick={() => handleRemove('expenses', item.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-ink/40 hover:text-rose-600 hover:bg-rose-50 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0 cursor-pointer active:scale-95"><Trash2 className="w-3.5 h-3.5"/></button>
                     </div>
                   );
                 })}

                 <button onClick={() => handleAdd('expenses')} className="w-full flex items-center justify-center gap-1.5 py-2.5 sm:py-3 text-xs sm:text-sm text-brand-ink hover:text-black bg-[#FAF9F6] hover:bg-[#F2EFE9] font-bold rounded-xl border border-dashed border-brand-border hover:border-rose-400/60 transition-all cursor-pointer active:scale-[0.99] mt-2.5 shadow-2xs">
                   <Plus className="w-4 h-4 text-rose-700" />
                   <span>Harcama Kalemi Ekle</span>
                 </button>
              </div>
              
              <div className="mt-4 pt-3.5 pb-3 px-3.5 bg-rose-50/60 rounded-xl border border-rose-100/90 flex justify-between items-center shrink-0 shadow-2xs">
                  <span className="text-xs font-bold text-rose-950/70 uppercase tracking-wider">TOPLAM HARCAMA</span>
                  <span className="text-base sm:text-lg font-bold text-rose-700 tabular-nums">₺{totalExpense.toLocaleString('tr-TR')}</span>
              </div>
            </div>

            {/* Borç Sütunu */}
            <div className={`flex flex-col space-y-5 ${
              mobileBudgetTab === 'all' || mobileBudgetTab === 'debts' ? 'flex' : 'hidden lg:flex'
            }`}>
               <div>
                 <div className="flex items-center justify-between mb-3 sm:mb-4 pb-2.5 border-b border-brand-border/70 shrink-0">
                    <div className="flex items-center space-x-2.5">
                      {debts.length > 0 && (
                        <input
                          type="checkbox"
                          checked={isAllDebtsSelected}
                          ref={el => {
                            if (el) {
                              el.indeterminate = isAnyDebtsSelected && !isAllDebtsSelected;
                            }
                          }}
                          onChange={toggleSelectAllDebts}
                          className="w-4 h-4 rounded-md border-brand-border text-rose-600 focus:ring-rose-500 transition-colors cursor-pointer"
                        />
                      )}
                      <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <CreditCard className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs sm:text-sm font-bold text-brand-ink uppercase tracking-wider">BORÇ (GENEL)</h3>
                        <span className="text-[10px] bg-rose-50 text-rose-800 font-bold px-2 py-0.5 rounded-full border border-rose-200/60">
                          {debts.length}
                        </span>
                      </div>
                    </div>
                    {isAnyDebtsSelected && (
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={handleBulkPayDebts}
                          className="flex items-center space-x-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200/80 px-2.5 py-1 rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
                          title="Seçilen Borçları Öde ve Giderlere Aktar"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Öde ({selectedDebtIds.length})</span>
                        </button>
                        <button
                          onClick={handleBulkDeleteDebts}
                          className="flex items-center space-x-1 text-xs font-bold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 px-2.5 py-1 rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
                          title="Seçilen Borçları Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Sil</span>
                        </button>
                      </div>
                    )}
                 </div>

                 <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                   {debts.map(item => {
                     const isSelected = selectedDebtIds.includes(item.id);
                     return (
                       <div key={item.id} className={`flex flex-col sm:flex-row sm:items-center group rounded-xl p-2 border transition-all relative gap-2 sm:gap-0 pl-10 ${isSelected ? 'bg-rose-50/40 border-rose-300 ring-1 ring-rose-200' : 'bg-white border-brand-border/70 hover:border-rose-300/80 shadow-2xs'}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedDebtIds(prev =>
                                prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                              );
                            }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-md border-brand-border text-rose-600 focus:ring-rose-500 transition-colors cursor-pointer"
                          />
                          <input type="text" value={item.name} onChange={e => handleUpdate('debts', item.id, 'name', e.target.value)} className="flex-1 min-w-0 px-2 py-1 text-xs sm:text-sm font-medium text-brand-ink bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-rose-500/30 rounded-lg border-none" placeholder="Borç Kalemi" />
                          
                          <div className="flex items-center justify-between sm:justify-end shrink-0 pl-2">
                            <div className="font-bold text-rose-800 flex items-center pr-2">
                              <span className="text-xs">₺</span>
                              <input type="number" value={item.amount || ''} onChange={e => handleUpdate('debts', item.id, 'amount', parseInt(e.target.value)||0)} className="w-16 sm:w-20 px-1 py-1 text-xs sm:text-sm font-bold text-right bg-transparent hover:bg-white focus:bg-white focus:ring-1 focus:ring-rose-500/30 rounded-lg border-none" />
                            </div>
                            <button 
                              onClick={() => handlePayDebt(item)} 
                              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 px-2 py-1 rounded-lg flex items-center space-x-1 text-xs font-bold transition-all ml-1 shadow-2xs active:scale-95 cursor-pointer"
                              title="Ödendi İşaretle (Harcamalara Aktar)"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="hidden sm:inline">Öde</span>
                            </button>
                          </div>

                          <button onClick={() => handleRemove('debts', item.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-brand-ink/40 hover:text-rose-600 hover:bg-rose-50 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-all shrink-0 ml-1 cursor-pointer active:scale-95"><Trash2 className="w-3.5 h-3.5"/></button>
                       </div>
                     );
                   })}
                   <button onClick={() => handleAdd('debts')} className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-brand-ink hover:text-black bg-[#FAF9F6] hover:bg-[#F2EFE9] font-bold rounded-xl border border-dashed border-brand-border hover:border-amber-400/60 transition-all cursor-pointer active:scale-[0.99] mt-2 shadow-2xs">
                     <Plus className="w-3.5 h-3.5 text-amber-700" />
                     <span>Genel Borç Ekle</span>
                   </button>
                 </div>
               </div>

               {/* Öğrenci Sınav Borçları Listesi */}
               <div className="flex-1 flex flex-col min-h-[220px]">
                 <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-brand-border/70 shrink-0">
                   <div className="flex items-center space-x-2.5">
                     {studentDebts.length > 0 && (
                       <input
                         type="checkbox"
                         checked={isAllStudentDebtsSelected}
                         ref={el => {
                           if (el) {
                             el.indeterminate = isAnyStudentDebtsSelected && !isAllStudentDebtsSelected;
                           }
                         }}
                         onChange={toggleSelectAllStudentDebts}
                         className="w-4 h-4 rounded-md border-brand-border text-amber-600 focus:ring-amber-500 transition-colors cursor-pointer"
                       />
                     )}
                     <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                       <GraduationCap className="w-3.5 h-3.5" />
                     </div>
                     <div className="flex items-center gap-1.5">
                       <h4 className="text-xs sm:text-sm font-bold text-brand-ink uppercase tracking-wider">
                         ÖĞRENCİ SINAV BORÇLARI
                       </h4>
                       <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200/60">
                         {studentDebts.length}
                       </span>
                     </div>
                   </div>
                   {isAnyStudentDebtsSelected && (
                     <button
                       onClick={handleBulkCollectStudentDebts}
                       className="flex items-center space-x-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200/80 px-2.5 py-1 rounded-xl transition-all active:scale-95 shadow-2xs cursor-pointer"
                       title="Seçili Öğrencilerin Kayıt Ücretini Toplu Tahsil Et"
                     >
                       <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                       <span>Toplu Tahsil Et ({selectedStudentDebtKeys.length})</span>
                     </button>
                   )}
                 </div>
                 
                 <div className="space-y-3 flex-1 overflow-y-auto max-h-64 pr-1">
                   {groupedStudentDebts.map(group => {
                     const isExpanded = !!expandedStudentDebts[group.examId];
                     const groupKeys = group.list.map(d => `${d.studentId}_${d.examId}`);
                     const isAllGroupSelected = groupKeys.every(key => selectedStudentDebtKeys.includes(key));
                     const isAnyGroupSelected = groupKeys.some(key => selectedStudentDebtKeys.includes(key));

                     return (
                       <div key={group.examId} className="border border-amber-100/90 rounded-2xl overflow-hidden bg-white shadow-2xs transition-all hover:shadow-xs hover:border-amber-200">
                         <div
                           onClick={() => toggleStudentDebtGroup(group.examId)}
                           className="flex items-center justify-between p-3 bg-amber-50/60 hover:bg-amber-100/50 cursor-pointer transition-colors"
                         >
                           <div className="flex items-center space-x-2.5 text-amber-950 min-w-0">
                             <input
                               type="checkbox"
                               checked={isAllGroupSelected}
                               ref={el => {
                                 if (el) el.indeterminate = isAnyGroupSelected && !isAllGroupSelected;
                               }}
                               onClick={(e) => e.stopPropagation()}
                               onChange={(e) => toggleSelectStudentDebtGroup(group.list, e as any)}
                               className="w-3.5 h-3.5 rounded-md border-amber-300 text-amber-700 focus:ring-amber-500 transition-colors cursor-pointer shrink-0"
                             />
                             {isExpanded ? (
                               <ChevronDown className="w-4 h-4 text-amber-700 shrink-0" />
                             ) : (
                               <ChevronRight className="w-4 h-4 text-amber-700 shrink-0" />
                             )}
                             <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                             <span className="text-xs font-bold truncate">{group.examName} Borçları</span>
                             <span className="text-[10px] bg-amber-100/90 text-amber-800 px-2 py-0.5 rounded-full font-bold shrink-0">
                               {group.list.length} Öğrenci
                             </span>
                           </div>
                           <span className="text-sm font-bold text-amber-800 shrink-0 ml-2">₺{group.totalFee.toLocaleString('tr-TR')}</span>
                         </div>
                         
                         {isExpanded && (
                           <div className="p-2 bg-[#FCFBF7] border-t border-brand-border/70 space-y-1.5 divide-y divide-brand-border/40">
                             {group.list.map((item, idx) => {
                               const key = `${item.studentId}_${item.examId}`;
                               const isSelected = selectedStudentDebtKeys.includes(key);
                               return (
                                 <div key={idx} className={`rounded-xl p-2 flex items-center justify-between transition-all relative pl-8 ${isSelected ? 'bg-amber-50/70 ring-1 ring-amber-300' : 'hover:bg-white'}`}>
                                   <input
                                     type="checkbox"
                                     checked={isSelected}
                                     onChange={() => {
                                       setSelectedStudentDebtKeys(prev =>
                                         prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
                                       );
                                     }}
                                     className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-md border-brand-border text-amber-600 focus:ring-amber-500 transition-colors cursor-pointer"
                                   />
                                   <div className="min-w-0 pr-2">
                                     <p className="text-xs font-bold text-brand-ink truncate">{item.studentName}</p>
                                     <span className="text-[10px] text-brand-ink/60 font-semibold inline-block px-1.5 py-0.2 rounded-md bg-[#F5F4F0] border border-brand-border/40 mt-0.5">
                                       {item.studentClass}
                                     </span>
                                   </div>
                                   <div className="flex items-center space-x-2 shrink-0">
                                     <span className="text-xs font-bold text-amber-900 font-sans">₺{item.fee.toLocaleString('tr-TR')}</span>
                                     <button
                                       onClick={() => handleCollectStudentDebt(item)}
                                       className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                                       title="Kayıt ücretini tahsil et ve bütçeye kaydet"
                                     >
                                       <CheckCircle2 className="w-3.5 h-3.5" />
                                       <span>Tahsil Et</span>
                                     </button>
                                   </div>
                                 </div>
                               );
                             })}
                           </div>
                         )}
                       </div>
                     );
                   })}
                   
                   {studentDebts.length === 0 && (
                     <div className="text-center py-6 text-xs text-emerald-800 bg-emerald-50/50 rounded-2xl border border-emerald-100 font-semibold flex flex-col items-center justify-center gap-1.5 shadow-2xs">
                       <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                       <span>Aktif ödenmemiş öğrenci sınav borcu bulunmuyor.</span>
                     </div>
                   )}
                 </div>
               </div>

               <div className="mt-4 pt-3.5 pb-3 px-3.5 bg-amber-50/60 rounded-xl border border-amber-100/90 space-y-1.5 shrink-0 shadow-2xs">
                  <div className="flex justify-between items-center text-xs font-medium text-brand-ink/70">
                    <span>Kurumsal Borçlar:</span>
                    <span className="font-bold text-brand-ink">₺{totalCorporateDebt.toLocaleString('tr-TR')}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-medium text-amber-800">
                    <span>Öğrenci Sınav Borçları:</span>
                    <span className="font-bold text-amber-900">₺{totalStudentDebt.toLocaleString('tr-TR')}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-amber-200/60">
                    <span className="text-xs font-bold text-amber-950 uppercase tracking-wider">TOPLAM BORÇ</span>
                    <span className="text-base sm:text-lg font-bold text-amber-700 tabular-nums">₺{totalDebt.toLocaleString('tr-TR')}</span>
                  </div>
               </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
