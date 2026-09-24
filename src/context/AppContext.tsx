import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Student, Exam, ExamResult, BudgetData, ExamHall, SeatingPlanItem, CloudBackupRecord, FullBackupData, FullBackupSummary, AppNotification, ExamKeys } from '../types';
import { generateId, recalculateLeagueForStudents } from '../lib/utils';
import { db, firebaseConfig, auth, doc, getDoc, setDoc, onSnapshot, collection, getDocs, deleteDoc, query, User } from '../lib/firebase';
import { 
  subscribeToNotifications, 
  displayBrowserNotification, 
  registerNotificationServiceWorker, 
  publishCloudNotification 
} from '../lib/notifications';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';

interface AppState {
  students: Student[];
  exams: Exam[];
  results: ExamResult[];
  budget: BudgetData;
  examHalls: ExamHall[];
  leagueMentors?: Record<string, string>;
  leagueTeamPoints?: Record<string, number>;
  approvedTransfers?: { studentNo: number; examName: string; toTeam: string }[];
  admins?: string[];
  teachers?: string[];
}

interface AppContextType {
  state: AppState;
  userRole: 'admin' | 'teacher' | 'guest';
  syncStatus: 'synced' | 'saving' | 'quota_exceeded' | 'offline' | 'error';
  syncErrorMessage?: string | null;
  cloudBackups: CloudBackupRecord[];
  isLoadingBackups: boolean;
  createCloudBackup: (backupName?: string, note?: string) => Promise<{ success: boolean; message: string; backupId?: string }>;
  fetchCloudBackups: () => Promise<void>;
  restoreCloudBackup: (backupId: string) => Promise<{ success: boolean; message: string; summary?: any }>;
  deleteCloudBackup: (backupId: string) => Promise<{ success: boolean; message: string }>;
  saveLocalBackupToCloud: (backupData: any, customName?: string) => Promise<{ success: boolean; message: string; backupId?: string }>;
  updateUsers: (admins: string[], teachers: string[]) => Promise<void>;
  setStudents: (students: Student[]) => void;
  setExams: (exams: Exam[]) => void;
  setResults: (results: ExamResult[]) => void;
  setBudget: (budget: BudgetData) => void;
  setExamHalls: (halls: ExamHall[]) => void;
  updateBudget: (type: 'incomes' | 'expenses' | 'debts', data: any[]) => void;
  updateLeagueSettings: (mentors: Record<string, string>, teamPoints: Record<string, number>) => void;
  approveTransfer: (studentNo: number, examName: string, toTeam: string) => void;
  updateExamKeys: (examId: string, keys: ExamKeys) => Promise<void>;
  updateExamOmr: (examId: string, omrData: Partial<Exam>) => Promise<void>;
  saveOmrExamResults: (examId: string, newResults: ExamResult[]) => Promise<void>;
  deleteOmrExamResult: (examId: string, studentIdentifier: string | number) => Promise<void>;
  deleteAllOmrExamResults: (examId: string) => Promise<void>;
  overwriteState: (newState: AppState) => void;
  restoreBackup: (backupData: any) => Promise<{ success: boolean; message: string; summary?: any }>;
  saveNow: () => Promise<void>;
  retrySync: () => Promise<void>;
  checkAndRefreshRole: () => Promise<'admin' | 'teacher' | 'guest'>;
  notifications: AppNotification[];
  unreadNotificationsCount: number;
  isNotificationModalOpen: boolean;
  setIsNotificationModalOpen: (open: boolean) => void;
  openNotificationModal: (prefilledData?: Partial<AppNotification>) => void;
  markNotificationsAsSeen: () => void;
  sendPushNotification: (notif: Omit<AppNotification, 'id' | 'createdAt'>) => Promise<{ success: boolean; id?: string; error?: string }>;
}

const defaultState: AppState = {
  students: [],
  exams: [],
  results: [],
  budget: { incomes: [], expenses: [], debts: [] },
  examHalls: [],
  leagueMentors: {},
  leagueTeamPoints: {},
  approvedTransfers: [],
  admins: ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com'],
  teachers: []
};

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- Financial Sync Engine ---
const syncFinancials = (students: Student[], exams: Exam[], budget: BudgetData): BudgetData => {
  // Same logic as before
  const safeBudget: BudgetData = {
    incomes: budget?.incomes || [],
    expenses: budget?.expenses || [],
    debts: budget?.debts || []
  };

  const currentIncomeMap = new Map(safeBudget.incomes.map(i => [`${i.studentId}-${i.examId}`, i]));
  const currentExpenseMap = new Map(safeBudget.expenses.map(e => [e.examId, e]));
  
  const newIncomes = students.flatMap(student => {
    return (student.examRegistrations || []).filter(reg => reg.isPaid).map(reg => {
      const exam = exams.find(e => e.id === reg.examId);
      const key = `${student.id}-${reg.examId}`;
      const existing = currentIncomeMap.get(key);
      if (existing) return existing;
      
      return {
        id: generateId(),
        name: `${student.name} - ${exam?.name || 'Sınav'} Katılım Ücreti`,
        amount: reg.fee,
        studentId: student.id,
        examId: reg.examId
      };
    });
  });

  const otherIncomes = safeBudget.incomes.filter(i => !i.studentId);
  
  const newExpenses = exams.filter(e => e.publisher && e.publisherFee && e.orderQuantity).map(exam => {
    const key = exam.id;
    const existing = currentExpenseMap.get(key);
    if (existing) return existing;
    
    return {
      id: generateId(),
      no: exam.no,
      name: `${exam.name} - ${exam.publisher} Yayınları Ödemesi`,
      amount: (exam.publisherFee || 0) * (exam.orderQuantity || 0),
      examId: exam.id
    };
  });

  const otherExpenses = safeBudget.expenses.filter(e => !e.examId);

  return {
    incomes: [...newIncomes, ...otherIncomes],
    expenses: [...newExpenses, ...otherExpenses],
    debts: safeBudget.debts
  };
};

const propagateManualBudgetChanges = (students: Student[], exams: Exam[], budget: BudgetData) => {
  let updatedStudents = students.map(student => {
    let studentRegsChanged = false;
    const updatedRegs = (student.examRegistrations || []).map(reg => {
      const budgetItem = budget.incomes.find(i => i.studentId === student.id && i.examId === reg.examId);
      if (budgetItem && budgetItem.amount !== reg.fee) {
        studentRegsChanged = true;
        return { ...reg, fee: budgetItem.amount };
      }
      return reg;
    });
    if (studentRegsChanged) {
      return { ...student, examRegistrations: updatedRegs };
    }
    return student;
  });

  let updatedExams = exams.map(exam => {
    const budgetItem = budget.expenses.find(exp => exp.examId === exam.id);
    const totalFee = (exam.publisherFee || 0) * (exam.orderQuantity || 0);
    if (budgetItem && budgetItem.amount !== totalFee) {
      const qty = exam.orderQuantity || 1;
      return {
        ...exam,
        publisherFee: budgetItem.amount / qty
      };
    }
    return exam;
  });

  return {
    updatedStudents,
    updatedExams,
    cleanedBudget: budget
  };
};

const loadInitialState = (): AppState => {
  try {
    const saved = localStorage.getItem('okulYonetimState');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        students: parsed.students || [],
        exams: parsed.exams || [],
        results: parsed.results || [],
        budget: parsed.budget || { incomes: [], expenses: [], debts: [] },
        examHalls: parsed.examHalls || [],
        leagueMentors: parsed.leagueMentors || {},
        leagueTeamPoints: parsed.leagueTeamPoints || {},
        approvedTransfers: parsed.approvedTransfers || [],
        admins: parsed.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com'],
        teachers: parsed.teachers || []
      };
    }
  } catch (e) {
    console.error('Error loading initial local state:', e);
  }
  return defaultState;
};

const getTodayDateStr = () => new Date().toISOString().slice(0, 10);

const checkIsQuotaExceededToday = () => {
  try {
    const savedDate = localStorage.getItem('firestore_quota_exceeded_date');
    const savedProject = localStorage.getItem('firestore_quota_exceeded_project');
    return savedDate === getTodayDateStr() && savedProject === firebaseConfig.projectId;
  } catch (e) {
    return false;
  }
};

const markQuotaExceededToday = () => {
  try {
    localStorage.setItem('firestore_quota_exceeded_date', getTodayDateStr());
    localStorage.setItem('firestore_quota_exceeded_project', firebaseConfig.projectId);
  } catch (e) {}
};

const clearQuotaExceeded = () => {
  try {
    localStorage.removeItem('firestore_quota_exceeded_date');
    localStorage.removeItem('firestore_quota_exceeded_project');
  } catch (e) {}
};

export const evaluateUserRole = (
  userEmail: string,
  adminsList: string[] = [],
  teachersList: string[] = []
): 'admin' | 'teacher' | 'guest' => {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  if (!cleanEmail) return 'guest';
  if (cleanEmail === 'kirklareliataturkortaokulu@gmail.com' || cleanEmail === 'bahadirkumcu@gmail.com') return 'admin';
  
  const normAdmins = (adminsList || []).map(a => (a || '').trim().toLowerCase());
  if (normAdmins.includes(cleanEmail)) return 'admin';
  
  const normTeachers = (teachersList || []).map(t => (t || '').trim().toLowerCase());
  if (normTeachers.includes(cleanEmail)) return 'teacher';
  
  return 'guest';
};

export const AppProvider = ({ children, user }: { children: ReactNode, user: User }) => {
  const isInitialQuotaExceeded = checkIsQuotaExceededToday();
  const [state, setState] = useState<AppState>(loadInitialState);
  const stateRef = useRef<AppState>(state);
  const lastSavedPayloadRef = useRef<string>('');
  const debounceTimerRef = useRef<any>(null);
  const isQuotaExceededRef = useRef(isInitialQuotaExceeded);
  const hasSentGuestRequestRef = useRef(false);

  const initialRole = evaluateUserRole(user?.email || '', state.admins, state.teachers);

  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'teacher' | 'guest'>(initialRole);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'quota_exceeded' | 'offline' | 'error'>(
    isInitialQuotaExceeded ? 'quota_exceeded' : 'synced'
  );
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(
    isInitialQuotaExceeded ? 'Firestore günlük ücretsiz yazma kotası doldu. Verileriniz bu cihazda kesintisiz ve güvenle saklanmaktadır.' : null
  );
  const [cloudBackups, setCloudBackups] = useState<CloudBackupRecord[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);

  // Push Notification & Announcement States
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [notificationPrefill, setNotificationPrefill] = useState<Partial<AppNotification> | null>(null);

  const markNotificationsAsSeen = () => {
    localStorage.setItem('last_seen_notification_ts', Date.now().toString());
    setUnreadNotificationsCount(0);
  };

  const openNotificationModal = (prefilledData?: Partial<AppNotification>) => {
    if (prefilledData) {
      setNotificationPrefill(prefilledData);
    } else {
      setNotificationPrefill(null);
    }
    markNotificationsAsSeen();
    setIsNotificationModalOpen(true);
  };

  const sendPushNotification = async (notif: Omit<AppNotification, 'id' | 'createdAt'>) => {
    return await publishCloudNotification(notif);
  };

  // Real-time Push Notifications listener & Service Worker registration
  useEffect(() => {
    registerNotificationServiceWorker().catch(() => {});

    const unsubscribeNotifs = subscribeToNotifications(
      (items) => {
        setNotifications(items);
        const lastSeen = parseInt(localStorage.getItem('last_seen_notification_ts') || '0', 10);
        const unread = items.filter(n => new Date(n.createdAt).getTime() > lastSeen).length;
        setUnreadNotificationsCount(unread);
      },
      (newNotif) => {
        displayBrowserNotification(
          newNotif.title,
          newNotif.message,
          newNotif.id,
          newNotif.linkTab
        );
      }
    );

    return () => {
      unsubscribeNotifs();
    };
  }, []);

  const checkAndRefreshRole = async (): Promise<'admin' | 'teacher' | 'guest'> => {
    try {
      const cleanEmail = (user?.email || '').trim().toLowerCase();
      if (!auth.currentUser) {
        const localRole = evaluateUserRole(cleanEmail, stateRef.current.admins, stateRef.current.teachers);
        setUserRole(localRole);
        return localRole;
      }

      const docRef = doc(db, 'schools', 'main');
      let snapshot;
      try {
        snapshot = await getDoc(docRef);
      } catch (err: any) {
        if (err?.code === 'permission-denied') {
          handleFirestoreError(err, OperationType.GET, 'schools/main');
        }
        throw err;
      }
      
      if (snapshot.exists()) {
        const data = snapshot.data() as AppState;
        const cleanAdmins = Array.from(new Set(
          (data.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com']).map(a => (a || '').trim().toLowerCase())
        ));
        const cleanTeachers = Array.from(new Set(
          (data.teachers || []).map(t => (t || '').trim().toLowerCase())
        ));

        const safeData: AppState = {
          students: data.students || [],
          exams: data.exams || [],
          results: data.results || [],
          budget: data.budget || { incomes: [], expenses: [], debts: [] },
          examHalls: data.examHalls || [],
          leagueMentors: data.leagueMentors || {},
          leagueTeamPoints: data.leagueTeamPoints || {},
          approvedTransfers: data.approvedTransfers || [],
          admins: cleanAdmins,
          teachers: cleanTeachers
        };

        safeData.budget = syncFinancials(safeData.students, safeData.exams, safeData.budget);
        setState(safeData);
        stateRef.current = safeData;

        try {
          localStorage.setItem('okulYonetimState', JSON.stringify(safeData));
        } catch (e) {}

        const newRole = evaluateUserRole(cleanEmail, cleanAdmins, cleanTeachers);
        setUserRole(newRole);
        return newRole;
      }
    } catch (e) {
      console.warn('Error refreshing role from Firestore:', e);
    }

    const currentRole = evaluateUserRole(user?.email || '', stateRef.current.admins, stateRef.current.teachers);
    setUserRole(currentRole);
    return currentRole;
  };

  // Firestore Real-time Listener with Quota & Offline Handling
  useEffect(() => {
    // Only attach onSnapshot listener if user is authenticated with Firebase Auth SDK
    if (!auth.currentUser) {
      const cleanUserEmail = (user?.email || '').trim().toLowerCase();
      const initialComputedRole = evaluateUserRole(cleanUserEmail, stateRef.current.admins, stateRef.current.teachers);
      setUserRole(initialComputedRole);
      setSyncStatus('synced');
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'schools', 'main');
    
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as AppState;
        
        const cleanAdmins = Array.from(new Set(
          (data.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com']).map(a => (a || '').trim().toLowerCase())
        ));
        const cleanTeachers = Array.from(new Set(
          (data.teachers || []).map(t => (t || '').trim().toLowerCase())
        ));

        const safeData: AppState = {
          students: data.students || [],
          exams: data.exams || [],
          results: data.results || [],
          budget: data.budget || { incomes: [], expenses: [], debts: [] },
          examHalls: data.examHalls || [],
          leagueMentors: data.leagueMentors || {},
          leagueTeamPoints: data.leagueTeamPoints || {},
          approvedTransfers: data.approvedTransfers || [],
          admins: cleanAdmins,
          teachers: cleanTeachers
        };
        
        safeData.budget = syncFinancials(safeData.students, safeData.exams, safeData.budget);
        
        setState(safeData);
        stateRef.current = safeData;
        
        // Cache to localStorage
        try {
          localStorage.setItem('okulYonetimState', JSON.stringify(safeData));
          lastSavedPayloadRef.current = JSON.stringify(safeData);
        } catch (e) {
          console.warn('LocalStorage save error:', e);
        }
        
        const cleanUserEmail = (user.email || '').trim().toLowerCase();
        const computedRole = evaluateUserRole(cleanUserEmail, safeData.admins, safeData.teachers);
        setUserRole(computedRole);

        if (computedRole === 'guest') {
          if (cleanUserEmail && !hasSentGuestRequestRef.current && !isQuotaExceededRef.current) {
            hasSentGuestRequestRef.current = true;
            setDoc(doc(db, 'access_requests', cleanUserEmail), {
              email: cleanUserEmail,
              name: user.displayName || cleanUserEmail.split('@')[0],
              timestamp: new Date().toISOString()
            }).catch(() => {});
          }
        }

        if (!isQuotaExceededRef.current) {
          setSyncStatus('synced');
          setSyncErrorMessage(null);
        }
      } else {
        // Doc doesn't exist yet, if user is super admin initialize it (only if quota not exceeded)
        const userEmail = (user.email || '').trim().toLowerCase();
        if (userEmail === 'kirklareliataturkortaokulu@gmail.com' || userEmail === 'bahadirkumcu@gmail.com') {
          setUserRole('admin');
          if (!isQuotaExceededRef.current) {
            setDoc(docRef, stateRef.current).catch((err) => {
              if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota') || err?.message?.includes('quota')) {
                markQuotaExceededToday();
                isQuotaExceededRef.current = true;
                setSyncStatus('quota_exceeded');
              } else if (err?.code === 'permission-denied') {
                handleFirestoreError(err, OperationType.WRITE, 'schools/main');
              }
            });
          }
        }
      }
      setLoading(false);
    }, (error: any) => {
      console.warn('Firestore snapshot error:', error);
      const isQuota = error?.code === 'resource-exhausted' || error?.message?.includes('Quota') || error?.message?.includes('quota');
      if (isQuota) {
        markQuotaExceededToday();
        isQuotaExceededRef.current = true;
        setSyncStatus('quota_exceeded');
        setSyncErrorMessage('Firestore günlük ücretsiz yazma kotası doldu. Verileriniz bu cihazda kesintisiz ve güvenle saklanmaktadır.');
      } else if (error?.code === 'permission-denied') {
        setSyncStatus('error');
        setSyncErrorMessage('Firebase Güvenlik Kuralları Engeli (permission-denied): Firebase Console -> Firestore Database -> Rules sekmesinde yetki verilmesi gerekmektedir.');
        handleFirestoreError(error, OperationType.GET, 'schools/main');
      } else if (error?.code === 'not-found' || error?.message?.includes('database')) {
        setSyncStatus('error');
        setSyncErrorMessage('Firestore Veritabanı Bulunamadı: Firebase Console üzerinde "Firestore Database" oluşturulduğundan emin olun.');
      } else {
        setSyncStatus('offline');
        setSyncErrorMessage(error?.message || 'Bulut bağlantısı bekleniyor. Verileriniz yerel hafızada korunmaktadır.');
      }

      const cleanUserEmail = (user.email || '').trim().toLowerCase();
      const fallbackRole = evaluateUserRole(cleanUserEmail, stateRef.current.admins, stateRef.current.teachers);
      setUserRole(fallbackRole);

      setLoading(false);
    });

    return () => unsubscribe();
  }, [user.uid, user.email]);

  // Performs actual Firestore write with error protection and status tracking
  const executeFirestoreWrite = async (newState: AppState, forceRetry = false) => {
    if (userRole !== 'admin') return;

    // If quota was already exceeded, skip background auto-writes to prevent retry storm unless manually forced
    if (isQuotaExceededRef.current && !forceRetry) {
      setSyncStatus('quota_exceeded');
      return;
    }

    if (!auth.currentUser) {
      // Local preview / unauthenticated mode: persistence is already handled by localStorage
      setSyncStatus('synced');
      return;
    }

    try {
      if (forceRetry) {
        clearQuotaExceeded();
        isQuotaExceededRef.current = false;
      }

      const cleanState = JSON.parse(JSON.stringify(newState));
      const payloadString = JSON.stringify(cleanState);

      // Skip redundant writes
      if (payloadString === lastSavedPayloadRef.current && !forceRetry) {
        setSyncStatus('synced');
        return;
      }

      setSyncStatus('saving');
      
      // Protect against hanging Firestore requests with a 15-second timeout
      const writePromise = setDoc(doc(db, 'schools', 'main'), cleanState);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Bulut bağlantısı zaman aşımına uğradı (15s). Firebase Firestore Database bağlantısını ve internetinizi kontrol edin. Verileriniz yerel hafızada güvendedir.')), 15000)
      );

      await Promise.race([writePromise, timeoutPromise]);
      
      lastSavedPayloadRef.current = payloadString;
      clearQuotaExceeded();
      isQuotaExceededRef.current = false;
      setSyncStatus('synced');
      setSyncErrorMessage(null);
    } catch (error: any) {
      console.warn('Firestore write error:', error);
      const isQuota = error?.code === 'resource-exhausted' || error?.message?.includes('Quota') || error?.message?.includes('quota');
      
      if (isQuota) {
        markQuotaExceededToday();
        isQuotaExceededRef.current = true;
        setSyncStatus('quota_exceeded');
        setSyncErrorMessage('Firestore günlük ücretsiz yazma kotası doldu. Verileriniz bu cihazda kesintisiz olarak korunmaktadır.');
      } else if (error?.code === 'permission-denied') {
        setSyncStatus('error');
        setSyncErrorMessage('Firebase Güvenlik Kuralı Engeli (permission-denied): Firebase Console -> Firestore -> Rules sekmesinde yetki verilmesi gerekiyor.');
        handleFirestoreError(error, OperationType.WRITE, 'schools/main');
      } else if (error?.code === 'not-found' || error?.message?.includes('database')) {
        setSyncStatus('error');
        setSyncErrorMessage('Firestore Veritabanı Bulunamadı: Firebase Console üzerinde Firestore Database oluşturulmalıdır.');
        throw error;
      } else {
        setSyncStatus('error');
        setSyncErrorMessage(error?.message || 'Buluta kaydedilemedi. Verileriniz yerel olarak güvendedir.');
        throw error;
      }
    }
  };

  const updateFirebase = (newState: AppState) => {
    stateRef.current = newState;
    setState(newState);

    // 1. Instant local persistence so data is never lost regardless of network/quota
    try {
      localStorage.setItem('okulYonetimState', JSON.stringify(newState));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // 2. If quota is known to be exceeded, don't spam background writes
    if (isQuotaExceededRef.current) {
      setSyncStatus('quota_exceeded');
      return;
    }

    // 3. Debounce cloud writes (2500ms) to prevent hitting Firestore write quota limits
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      executeFirestoreWrite(newState);
    }, 2500);
  };

  const saveNow = async () => {
    if (userRole !== 'admin') return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    // Always persist to localStorage
    try {
      localStorage.setItem('okulYonetimState', JSON.stringify(stateRef.current));
    } catch (e) {}

    await executeFirestoreWrite(stateRef.current, true);
  };

  const retrySync = async () => {
    if (userRole !== 'admin') return;
    clearQuotaExceeded();
    isQuotaExceededRef.current = false;
    await executeFirestoreWrite(stateRef.current, true);
  };

  const setStudents = (students: Student[]) => { if (userRole !== 'admin') return; _setStudents(students); };
  const _setStudents = (students: Student[]) => {
    const s = stateRef.current;
    const updatedHalls = s.examHalls.map(hall => {
      const sp = hall.seatingPlan || [];
      let changed = false;
      const newSp = sp.map(item => {
        const student = students.find(st => st.id === item.studentId);
        if (!student) { changed = true; return null; }
        
        const assignedExamIds = hall.examIds || (hall.examId ? [hall.examId] : []);
        if (assignedExamIds.length > 0) {
          const isRegistered = student.examRegistrations?.some(reg => assignedExamIds.includes(reg.examId));
          if (!isRegistered) { changed = true; return null; }
        }
        
        if (item.studentNo !== student.no || item.studentName !== student.name || item.studentClass !== student.className) {
          changed = true;
          return { ...item, studentNo: student.no, studentName: student.name, studentClass: student.className };
        }
        return item;
      }).filter(Boolean) as SeatingPlanItem[];
      
      if (changed || newSp.length !== sp.length) {
        return { ...hall, seatingPlan: newSp };
      }
      return hall;
    });
    
    const newBudget = syncFinancials(students, s.exams, s.budget);
    updateFirebase({ ...s, students, examHalls: updatedHalls, budget: newBudget });
  };

  const setExams = (exams: Exam[]) => { if (userRole !== 'admin') return; _setExams(exams); };
  const _setExams = (exams: Exam[]) => {
    const s = stateRef.current;
    const updatedHalls = s.examHalls.map(hall => {
      const matchingExams = exams.filter(e => e.assignedHalls?.includes(hall.id));
      const newExamIds = matchingExams.map(e => e.id);
      const currentIds = hall.examIds || [];
      const isSame = currentIds.length === newExamIds.length && currentIds.every(id => newExamIds.includes(id));
      
      let spChanged = false;
      const currentSp = hall.seatingPlan || [];
      const newSp = currentSp.filter(item => {
        const student = s.students.find(st => st.id === item.studentId);
        if (!student) { spChanged = true; return false; }
        if (newExamIds.length > 0) {
          const hasReg = student.examRegistrations?.some(reg => newExamIds.includes(reg.examId));
          if (!hasReg) { spChanged = true; return false; }
        } else {
          spChanged = true; return false;
        }
        return true;
      });
      if (!isSame || spChanged) {
        return { ...hall, examIds: newExamIds, examId: newExamIds.length > 0 ? newExamIds[0] : undefined, seatingPlan: newSp };
      }
      return hall;
    });
    
    const newBudget = syncFinancials(s.students, exams, s.budget);
    
    // Clean up student registrations for exams that no longer exist
    const newExamIds = exams.map(e => e.id);
    const studentsWithCleanRegs = s.students.map(st => {
      const regs = st.examRegistrations || [];
      const filtered = regs.filter(r => newExamIds.includes(r.examId));
      if (filtered.length !== regs.length) { return { ...st, examRegistrations: filtered }; }
      return st;
    });
    const updatedStudents = recalculateLeagueForStudents(studentsWithCleanRegs, s.results, exams, s.approvedTransfers || []);
    updateFirebase({ ...s, exams, examHalls: updatedHalls, budget: newBudget, students: updatedStudents });
  };

  const setResults = (results: ExamResult[]) => { if (userRole !== 'admin') return; _setResults(results); };
  const _setResults = (results: ExamResult[]) => {
    const s = stateRef.current;
    const updatedStudents = recalculateLeagueForStudents(s.students, results, s.exams, s.approvedTransfers || []);
    updateFirebase({ ...s, results, students: updatedStudents });
  };
  
  const setBudget = (budget: BudgetData) => { if (userRole !== 'admin') return; _setBudget(budget); };
  const _setBudget = (budget: BudgetData) => {
    const s = stateRef.current;
    const { updatedStudents, updatedExams, cleanedBudget } = propagateManualBudgetChanges(s.students, s.exams, budget);
    const finalBudget = syncFinancials(updatedStudents, updatedExams, cleanedBudget);
    updateFirebase({ ...s, students: updatedStudents, exams: updatedExams, budget: finalBudget });
  };

  const setExamHalls = (examHalls: ExamHall[]) => { if (userRole !== 'admin') return; _setExamHalls(examHalls); };
  const _setExamHalls = (examHalls: ExamHall[]) => {
    const s = stateRef.current;
    const updatedExams = s.exams.map(exam => {
      const matchingHalls = examHalls.filter(h => h.examIds?.includes(exam.id) || h.examId === exam.id);
      const newAssignedHalls = matchingHalls.map(h => h.id);
      const currentAssigned = exam.assignedHalls || [];
      const isSame = currentAssigned.length === newAssignedHalls.length && currentAssigned.every(id => newAssignedHalls.includes(id));
      
      if (!isSame) { return { ...exam, assignedHalls: newAssignedHalls }; }
      return exam;
    });
    updateFirebase({ ...s, examHalls, exams: updatedExams });
  };
  
  const updateBudget = (type: 'incomes' | 'expenses' | 'debts', data: any[]) => { if (userRole !== 'admin') return; _updateBudget(type, data); };
  const _updateBudget = (type: 'incomes' | 'expenses' | 'debts', data: any[]) => {
    const s = stateRef.current;
    const nextBudget = { ...s.budget, [type]: data };
    const { updatedStudents, updatedExams, cleanedBudget } = propagateManualBudgetChanges(s.students, s.exams, nextBudget);
    const finalBudget = syncFinancials(updatedStudents, updatedExams, cleanedBudget);
    updateFirebase({ ...s, students: updatedStudents, exams: updatedExams, budget: finalBudget });
  };

  const updateLeagueSettings = (mentors: Record<string, string>, teamPoints: Record<string, number>) => { if (userRole !== 'admin') return; _updateLeagueSettings(mentors, teamPoints); };
  const _updateLeagueSettings = (mentors: Record<string, string>, teamPoints: Record<string, number>) => {
    const s = stateRef.current;
    updateFirebase({ ...s, leagueMentors: mentors, leagueTeamPoints: teamPoints });
  };

  const updateUsers = async (admins: string[], teachers: string[]) => {
    if (userRole !== 'admin') return;
    const cleanAdmins = Array.from(new Set(
      admins.map(a => (a || '').trim().toLowerCase()).filter(Boolean)
    ));
    if (!cleanAdmins.includes('kirklareliataturkortaokulu@gmail.com')) cleanAdmins.push('kirklareliataturkortaokulu@gmail.com');
    if (!cleanAdmins.includes('bahadirkumcu@gmail.com')) cleanAdmins.push('bahadirkumcu@gmail.com');

    const cleanTeachers = Array.from(new Set(
      teachers.map(t => (t || '').trim().toLowerCase()).filter(Boolean)
    )).filter(t => !cleanAdmins.includes(t));

    const s: AppState = {
      ...stateRef.current,
      admins: cleanAdmins,
      teachers: cleanTeachers
    };

    stateRef.current = s;
    setState(s);

    try {
      localStorage.setItem('okulYonetimState', JSON.stringify(s));
    } catch (e) {}

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    try {
      await executeFirestoreWrite(s, true);
    } catch (e) {
      console.warn('Error syncing updated users to Firestore:', e);
    }
  };

  const approveTransfer = (studentNo: number, examName: string, toTeam: string) => { if (userRole !== 'admin') return; _approveTransfer(studentNo, examName, toTeam); };
  const _approveTransfer = (studentNo: number, examName: string, toTeam: string) => {
    const s = stateRef.current;
    const newApproved = [...(s.approvedTransfers || []), { studentNo, examName, toTeam }];
    const updatedStudents = recalculateLeagueForStudents(s.students, s.results, s.exams, newApproved);
    updateFirebase({ ...s, approvedTransfers: newApproved, students: updatedStudents });
  };

  const updateExamKeys = async (examId: string, keys: ExamKeys) => {
    if (userRole !== 'admin') return;
    const s = stateRef.current;
    const updatedExams = s.exams.map(e => {
      if (String(e.id) === String(examId)) {
        return { ...e, keys };
      }
      return e;
    });
    const nextState = { ...s, exams: updatedExams };
    updateFirebase(nextState);
    await executeFirestoreWrite(nextState, true);
  };

  const updateExamOmr = async (examId: string, omrData: Partial<Exam>) => {
    if (userRole !== 'admin') return;
    const s = stateRef.current;
    const updatedExams = s.exams.map(e => {
      if (String(e.id) === String(examId)) {
        return { ...e, ...omrData };
      }
      return e;
    });
    const nextState = { ...s, exams: updatedExams };
    updateFirebase(nextState);
    await executeFirestoreWrite(nextState, true);
  };

  const saveOmrExamResults = async (examId: string, newResults: ExamResult[]) => {
    if (userRole !== 'admin' && userRole !== 'teacher') return;
    const s = stateRef.current;
    const targetExam = s.exams.find(e => String(e.id) === String(examId));
    if (!targetExam) return;

    const existingResults = [...s.results];

    newResults.forEach(nr => {
      const existingIdx = existingResults.findIndex(r => 
        (nr.studentId && r.studentId === nr.studentId) ||
        (nr.studentNo && (r.studentNo === nr.studentNo || r.no === nr.studentNo)) ||
        (nr.no && (r.no === nr.no || r.studentNo === Number(nr.no)))
      );

      const scoreValue = nr.evaluatedScore 
        ? (nr.evaluatedScore.total.lgsScore || nr.evaluatedScore.total.tytScore || nr.evaluatedScore.total.net) 
        : (nr.scores ? (nr.scores[examId] || nr.scores[targetExam.name] || 0) : 0);

      if (existingIdx >= 0) {
        const existing = existingResults[existingIdx];
        const updatedScores = { ...(existing.scores || {}), [examId]: scoreValue, [targetExam.name]: scoreValue };
        existingResults[existingIdx] = {
          ...existing,
          ...nr,
          id: existing.id,
          scores: updatedScores,
          evaluatedScore: nr.evaluatedScore || existing.evaluatedScore
        };
      } else {
        const newResId = nr.id || generateId();
        existingResults.push({
          ...nr,
          id: newResId,
          scores: { ...(nr.scores || {}), [examId]: scoreValue, [targetExam.name]: scoreValue }
        });
      }
    });

    // Merge into targetExam.results properly so results are never lost
    const currentExamResults = [...(targetExam.results || [])];
    newResults.forEach(nr => {
      const idx = currentExamResults.findIndex(r => 
        (nr.studentId && r.studentId === nr.studentId) ||
        (nr.studentNo && (r.studentNo === nr.studentNo || r.no === nr.studentNo)) ||
        (nr.no && (r.no === nr.no || r.studentNo === Number(nr.no)))
      );
      if (idx >= 0) {
        currentExamResults[idx] = { ...currentExamResults[idx], ...nr };
      } else {
        currentExamResults.push(nr);
      }
    });

    const updatedExam: Exam = {
      ...targetExam,
      participantCount: Math.max(targetExam.participantCount || 0, currentExamResults.length),
      results: currentExamResults
    };

    const updatedExams = s.exams.map(e => String(e.id) === String(examId) ? updatedExam : e);
    const updatedStudents = recalculateLeagueForStudents(s.students, existingResults, updatedExams, s.approvedTransfers || []);

    const nextState: AppState = {
      ...s,
      exams: updatedExams,
      results: existingResults,
      students: updatedStudents
    };

    updateFirebase(nextState);
    await executeFirestoreWrite(nextState, true);
  };

  const deleteOmrExamResult = async (examId: string, studentIdentifier: string | number) => {
    if (userRole !== 'admin' && userRole !== 'teacher') return;
    const s = stateRef.current;
    const targetExam = s.exams.find(e => String(e.id) === String(examId));
    if (!targetExam) return;

    const idStr = String(studentIdentifier).trim();

    // 1. Remove from targetExam.results
    const currentExamResults = [...(targetExam.results || [])];
    const updatedExamResults = currentExamResults.filter(r => {
      const matchId = r.id !== undefined && String(r.id).trim() === idStr;
      const matchNo = r.no !== undefined && String(r.no).trim() === idStr;
      const matchStudentNo = r.studentNo !== undefined && String(r.studentNo).trim() === idStr;
      const matchStudentId = r.studentId !== undefined && String(r.studentId).trim() === idStr;
      return !(matchId || matchNo || matchStudentNo || matchStudentId);
    });

    const updatedExam: Exam = {
      ...targetExam,
      participantCount: updatedExamResults.length,
      results: updatedExamResults
    };

    // 2. Clean from global s.results (remove score for this exam)
    const existingResults = s.results.map(r => {
      const matchId = r.id !== undefined && String(r.id).trim() === idStr;
      const matchNo = r.no !== undefined && String(r.no).trim() === idStr;
      const matchStudentNo = r.studentNo !== undefined && String(r.studentNo).trim() === idStr;
      const matchStudentId = r.studentId !== undefined && String(r.studentId).trim() === idStr;

      if (matchId || matchNo || matchStudentNo || matchStudentId) {
        const updatedScores = { ...(r.scores || {}) };
        delete updatedScores[examId];
        delete updatedScores[targetExam.name];
        return {
          ...r,
          scores: updatedScores,
          evaluatedScore: Object.keys(updatedScores).length === 0 ? undefined : r.evaluatedScore
        };
      }
      return r;
    });

    const updatedExams = s.exams.map(e => String(e.id) === String(examId) ? updatedExam : e);
    const updatedStudents = recalculateLeagueForStudents(s.students, existingResults, updatedExams, s.approvedTransfers || []);

    const nextState: AppState = {
      ...s,
      exams: updatedExams,
      results: existingResults,
      students: updatedStudents
    };

    updateFirebase(nextState);
    await executeFirestoreWrite(nextState, true);
  };

  const deleteAllOmrExamResults = async (examId: string) => {
    if (userRole !== 'admin' && userRole !== 'teacher') return;
    const s = stateRef.current;
    const targetExam = s.exams.find(e => String(e.id) === String(examId));
    if (!targetExam) return;

    const updatedExam: Exam = {
      ...targetExam,
      participantCount: 0,
      results: []
    };

    const existingResults = s.results.map(r => {
      if (r.scores && (r.scores[examId] !== undefined || r.scores[targetExam.name] !== undefined)) {
        const updatedScores = { ...r.scores };
        delete updatedScores[examId];
        delete updatedScores[targetExam.name];
        return {
          ...r,
          scores: updatedScores,
          evaluatedScore: Object.keys(updatedScores).length === 0 ? undefined : r.evaluatedScore
        };
      }
      return r;
    });

    const updatedExams = s.exams.map(e => String(e.id) === String(examId) ? updatedExam : e);
    const updatedStudents = recalculateLeagueForStudents(s.students, existingResults, updatedExams, s.approvedTransfers || []);

    const nextState: AppState = {
      ...s,
      exams: updatedExams,
      results: existingResults,
      students: updatedStudents
    };

    updateFirebase(nextState);
    await executeFirestoreWrite(nextState, true);
  };

  const restoreBackup = async (rawBackup: any): Promise<{ success: boolean; message: string; summary?: any }> => {
    if (userRole !== 'admin') {
      return { success: false, message: 'Yedek yükleme işlemi yalnızca yetkili yöneticiler tarafından gerçekleştirilebilir.' };
    }

    if (!rawBackup || typeof rawBackup !== 'object') {
      return { success: false, message: 'Geçersiz yedek dosyası formatı.' };
    }

    // Support nested payload if wrapped under .data or .appState
    const source = (rawBackup.students || rawBackup.exams || rawBackup.results || rawBackup.budget || rawBackup.examHalls)
      ? rawBackup
      : (rawBackup.data || rawBackup.appState || rawBackup);

    const hasRecognizableData = 
      Array.isArray(source.students) || 
      Array.isArray(source.exams) || 
      Array.isArray(source.results) || 
      Array.isArray(source.examHalls) || 
      (source.budget && typeof source.budget === 'object');

    if (!hasRecognizableData) {
      return { success: false, message: 'Yedek dosyasında geçerli okul verisi (öğrenci, sınav, salon veya bütçe) bulunamadı.' };
    }

    // 1. Sanitize students
    const cleanStudents: Student[] = Array.isArray(source.students)
      ? source.students.map((s: any) => ({
          id: s.id || generateId(),
          no: Number(s.no) || 0,
          name: String(s.name || '').trim(),
          className: String(s.className || '').trim(),
          examRegistrations: Array.isArray(s.examRegistrations) ? s.examRegistrations : [],
          leagueTeam: s.leagueTeam || 'Atanmadı',
          leaguePoints: Number(s.leaguePoints) || 0,
          badges: s.badges || undefined,
          lastTransfer: s.lastTransfer || undefined,
          classStr: s.classStr || undefined,
          sectionStr: s.sectionStr || undefined,
          booklet: s.booklet || undefined
        }))
      : [];

    // 2. Sanitize exams
    const cleanExams: Exam[] = Array.isArray(source.exams)
      ? source.exams.map((e: any) => ({
          id: String(e.id || generateId()),
          no: Number(e.no) || 0,
          date: String(e.date || ''),
          name: String(e.name || '').trim(),
          participantCount: Number(e.participantCount) || 0,
          publisher: e.publisher ? String(e.publisher) : undefined,
          publisherFee: e.publisherFee !== undefined ? Number(e.publisherFee) : undefined,
          orderQuantity: e.orderQuantity !== undefined ? Number(e.orderQuantity) : undefined,
          gradeOrderQuantities: e.gradeOrderQuantities || undefined,
          participatingClasses: Array.isArray(e.participatingClasses) ? e.participatingClasses : [],
          assignedHalls: Array.isArray(e.assignedHalls) ? e.assignedHalls : [],
          institution: e.institution ? String(e.institution) : undefined,
          logo: e.logo || null,
          studentList: Array.isArray(e.studentList) ? e.studentList : undefined,
          layoutType: e.layoutType || undefined,
          format: e.format || undefined,
          subjects: Array.isArray(e.subjects) ? e.subjects : undefined,
          optionsCount: e.optionsCount !== undefined ? Number(e.optionsCount) : undefined,
          penalty: e.penalty !== undefined ? Number(e.penalty) : undefined,
          keys: e.keys && typeof e.keys === 'object' ? e.keys : undefined,
          results: Array.isArray(e.results) ? e.results : undefined
        }))
      : [];

    // 3. Sanitize results
    const cleanResults: ExamResult[] = Array.isArray(source.results)
      ? source.results.map((r: any) => ({
          id: String(r.id || generateId()),
          studentId: r.studentId ? String(r.studentId) : undefined,
          studentNo: r.studentNo !== undefined ? Number(r.studentNo) : (r.no !== undefined ? Number(r.no) : 0),
          studentName: String(r.studentName || r.name || '').trim(),
          studentClass: String(r.studentClass || r.classStr || '').trim(),
          scores: r.scores && typeof r.scores === 'object' ? r.scores : {},
          average: Number(r.average) || 0,
          details: r.details && typeof r.details === 'object' ? r.details : undefined,
          earnedLP: r.earnedLP !== undefined ? Number(r.earnedLP) : undefined,
          earnedBadges: Array.isArray(r.earnedBadges) ? r.earnedBadges : undefined,
          name: r.name ? String(r.name) : undefined,
          no: r.no !== undefined ? r.no : undefined,
          classStr: r.classStr ? String(r.classStr) : undefined,
          sectionStr: r.sectionStr ? String(r.sectionStr) : undefined,
          booklet: r.booklet ? String(r.booklet) : undefined,
          answers: Array.isArray(r.answers) ? r.answers : undefined,
          evaluatedScore: r.evaluatedScore && typeof r.evaluatedScore === 'object' ? r.evaluatedScore : undefined
        }))
      : [];

    // 4. Sanitize halls
    const cleanHalls: ExamHall[] = Array.isArray(source.examHalls)
      ? source.examHalls.map((h: any) => ({
          id: h.id || generateId(),
          name: String(h.name || '').trim(),
          capacity: Number(h.capacity) || 0,
          examId: h.examId ? String(h.examId) : undefined,
          examIds: Array.isArray(h.examIds) ? h.examIds : (h.examId ? [String(h.examId)] : []),
          selectedClasses: Array.isArray(h.selectedClasses) ? h.selectedClasses : [],
          seatingPlan: Array.isArray(h.seatingPlan) ? h.seatingPlan : [],
          columns: Array.isArray(h.columns) ? h.columns : []
        }))
      : [];

    // 5. Sanitize budget
    const rawBudget = source.budget || {};
    const cleanBudget: BudgetData = {
      incomes: Array.isArray(rawBudget.incomes) ? rawBudget.incomes : [],
      expenses: Array.isArray(rawBudget.expenses) ? rawBudget.expenses : [],
      debts: Array.isArray(rawBudget.debts) ? rawBudget.debts : []
    };

    // 6. Sanitize arena
    const cleanLeagueMentors: Record<string, string> = 
      source.leagueMentors && typeof source.leagueMentors === 'object' ? source.leagueMentors : {};
    const cleanLeagueTeamPoints: Record<string, number> = 
      source.leagueTeamPoints && typeof source.leagueTeamPoints === 'object' ? source.leagueTeamPoints : {};
    const cleanApprovedTransfers = Array.isArray(source.approvedTransfers) ? source.approvedTransfers : [];

    // 7. Sanitize admins & teachers (preserving super admin)
    const superAdminEmails = ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com'];
    const adminSet = new Set<string>(superAdminEmails);
    if (Array.isArray(source.admins)) {
      source.admins.forEach((a: string) => { if (a && typeof a === 'string') adminSet.add(a); });
    }
    const cleanAdmins = Array.from(adminSet);
    const cleanTeachers: string[] = Array.isArray(source.teachers) ? source.teachers.filter(Boolean) : [];

    // 8. Cross-module calculations
    const syncedBudget = syncFinancials(cleanStudents, cleanExams, cleanBudget);
    const updatedStudents = recalculateLeagueForStudents(cleanStudents, cleanResults, cleanExams, cleanApprovedTransfers);

    const fullState: AppState = {
      students: updatedStudents,
      exams: cleanExams,
      results: cleanResults,
      budget: syncedBudget,
      examHalls: cleanHalls,
      leagueMentors: cleanLeagueMentors,
      leagueTeamPoints: cleanLeagueTeamPoints,
      approvedTransfers: cleanApprovedTransfers,
      admins: cleanAdmins,
      teachers: cleanTeachers
    };

    // 9. Update state and local storage immediately
    stateRef.current = fullState;
    setState(fullState);
    try {
      localStorage.setItem('okulYonetimState', JSON.stringify(fullState));
      if (source.examCalendarPrintSettings) {
        localStorage.setItem('akademi_exam_calendar_print_config', JSON.stringify(source.examCalendarPrintSettings));
        window.dispatchEvent(new CustomEvent('exam-calendar-settings-restored', { detail: source.examCalendarPrintSettings }));
      }
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // 10. Force write to Firebase immediately
    await executeFirestoreWrite(fullState, true);

    const summary = {
      studentCount: updatedStudents.length,
      examCount: cleanExams.length,
      resultCount: cleanResults.length,
      hallCount: cleanHalls.length,
      incomeCount: syncedBudget.incomes.length,
      expenseCount: syncedBudget.expenses.length,
      debtCount: syncedBudget.debts.length
    };

    return {
      success: true,
      message: 'Tüm sistem içerikleri başarıyla yüklendi ve buluta aktarıldı.',
      summary
    };
  };

  // --- Cloud Backup & Snapshot Engine ---
  const fetchCloudBackups = async () => {
    if (userRole !== 'admin') return;
    if (!auth.currentUser) {
      setIsLoadingBackups(false);
      return;
    }
    setIsLoadingBackups(true);
    try {
      const q = query(collection(db, 'schools', 'main', 'backups'));
      const snapshot = await getDocs(q);
      const list: CloudBackupRecord[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as CloudBackupRecord);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCloudBackups(list);
    } catch (err: any) {
      console.warn('Fetch cloud backups notice:', err?.message || err);
      if (err?.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.LIST, 'schools/main/backups');
      }
    } finally {
      setIsLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (userRole === 'admin' && auth.currentUser) {
      const q = query(collection(db, 'schools', 'main', 'backups'));
      const unsub = onSnapshot(q, (snapshot) => {
        const list: CloudBackupRecord[] = [];
        snapshot.forEach(docSnap => {
          list.push(docSnap.data() as CloudBackupRecord);
        });
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setCloudBackups(list);
        setIsLoadingBackups(false);
      }, (err) => {
        console.warn('Backups onSnapshot notice:', err?.message || err);
        setIsLoadingBackups(false);
        if (err?.code === 'permission-denied') {
          handleFirestoreError(err, OperationType.LIST, 'schools/main/backups');
        }
      });
      return () => unsub();
    }
  }, [userRole, user?.email]);

  const createCloudBackup = async (backupName?: string, note?: string): Promise<{ success: boolean; message: string; backupId?: string }> => {
    if (userRole !== 'admin') {
      return { success: false, message: 'Bulut yedeği alma yetkisi yalnızca yöneticilere aittir.' };
    }

    try {
      const currentAuthUser = auth.currentUser;
      const currentUserEmail = (currentAuthUser?.email || user?.email || '').trim().toLowerCase();
      
      const s = stateRef.current;
      const summary: FullBackupSummary = {
        studentCount: s.students?.length || 0,
        examCount: s.exams?.length || 0,
        resultCount: s.results?.length || 0,
        hallCount: s.examHalls?.length || 0,
        budgetIncomesCount: s.budget?.incomes?.length || 0,
        budgetExpensesCount: s.budget?.expenses?.length || 0,
        budgetDebtsCount: s.budget?.debts?.length || 0,
        arenaMentorsCount: Object.keys(s.leagueMentors || {}).length,
        arenaBonusCount: Object.keys(s.leagueTeamPoints || {}).length,
        approvedTransferCount: s.approvedTransfers?.length || 0
      };

      const now = new Date();
      const backupId = `backup_${now.getTime()}`;
      const defaultName = backupName?.trim() || `AkademiPanel Yedeği (${now.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})`;
      
      const backupPayload: CloudBackupRecord = {
        id: backupId,
        name: defaultName,
        createdAt: now.toISOString(),
        createdByEmail: currentUserEmail,
        createdByName: currentAuthUser?.displayName || (currentUserEmail ? currentUserEmail.split('@')[0] : 'Yönetici'),
        summary,
        data: {
          appName: "Akademi Panel 2",
          version: "2.0",
          backupDate: now.toISOString(),
          school: "Kırklareli Atatürk Ortaokulu",
          summary,
          students: s.students || [],
          exams: s.exams || [],
          results: s.results || [],
          examHalls: s.examHalls || [],
          budget: s.budget || { incomes: [], expenses: [], debts: [] },
          leagueMentors: s.leagueMentors || {},
          leagueTeamPoints: s.leagueTeamPoints || {},
          approvedTransfers: s.approvedTransfers || [],
          admins: s.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com'],
          teachers: s.teachers || [],
          examCalendarPrintSettings: (() => {
            try {
              const cfg = localStorage.getItem('akademi_exam_calendar_print_config');
              return cfg ? JSON.parse(cfg) : undefined;
            } catch {
              return undefined;
            }
          })()
        },
        note: note?.trim() || undefined
      };

      if (!auth.currentUser) {
        // Safe local storage in preview/unauthenticated mode
        const localListRaw = localStorage.getItem('akademi_cloud_backups_local');
        const localList: CloudBackupRecord[] = localListRaw ? JSON.parse(localListRaw) : [];
        localList.unshift(backupPayload);
        localStorage.setItem('akademi_cloud_backups_local', JSON.stringify(localList));
        setCloudBackups(prev => [backupPayload, ...prev.filter(b => b.id !== backupId)]);
        return {
          success: true,
          message: `Bulut yedeği "${backupPayload.name}" yerel hafızaya güvenle kaydedildi.`,
          backupId
        };
      }

      const backupRef = doc(db, 'schools', 'main', 'backups', backupId);
      await setDoc(backupRef, JSON.parse(JSON.stringify(backupPayload)));

      setCloudBackups(prev => [backupPayload, ...prev.filter(b => b.id !== backupId)]);

      return {
        success: true,
        message: `Bulut yedeği "${backupPayload.name}" başarıyla Firebase'e kaydedildi.`,
        backupId
      };
    } catch (error: any) {
      console.error('Error creating cloud backup:', error);
      let errMsg = error?.message || 'Bulut yedeği oluşturulurken bir hata oluştu.';
      if (error?.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.CREATE, 'schools/main/backups');
        errMsg = 'Firebase Yetki Engeli: Google ile giriş yapmış yetkili yönetici olmanız gerekmektedir.';
      }
      return { success: false, message: errMsg };
    }
  };

  const saveLocalBackupToCloud = async (backupData: any, customName?: string): Promise<{ success: boolean; message: string; backupId?: string }> => {
    if (userRole !== 'admin') {
      return { success: false, message: 'Yetkisiz işlem.' };
    }
    try {
      const source = (backupData.students || backupData.exams || backupData.results || backupData.budget || backupData.examHalls)
        ? backupData
        : (backupData.data || backupData.appState || backupData);

      const summary: FullBackupSummary = {
        studentCount: Array.isArray(source.students) ? source.students.length : 0,
        examCount: Array.isArray(source.exams) ? source.exams.length : 0,
        resultCount: Array.isArray(source.results) ? source.results.length : 0,
        hallCount: Array.isArray(source.examHalls) ? source.examHalls.length : 0,
        budgetIncomesCount: source.budget?.incomes?.length || 0,
        budgetExpensesCount: source.budget?.expenses?.length || 0,
        budgetDebtsCount: source.budget?.debts?.length || 0,
        arenaMentorsCount: Object.keys(source.leagueMentors || {}).length,
        arenaBonusCount: Object.keys(source.leagueTeamPoints || {}).length,
        approvedTransferCount: source.approvedTransfers?.length || 0
      };

      const now = new Date();
      const backupId = `backup_${now.getTime()}`;
      const defaultName = customName || (source.backupDate ? `İçe Aktarılan Yedek (${source.backupDate.slice(0, 10)})` : `Yüklenen Dosya Yedeği - ${now.toLocaleDateString('tr-TR')}`);

      const backupPayload: CloudBackupRecord = {
        id: backupId,
        name: defaultName,
        createdAt: now.toISOString(),
        createdByEmail: (auth.currentUser?.email || user?.email || '').trim().toLowerCase(),
        createdByName: auth.currentUser?.displayName || 'Yönetici',
        summary,
        data: source,
        note: 'Cihazdan yüklenen JSON dosyası'
      };

      if (!auth.currentUser) {
        const localListRaw = localStorage.getItem('akademi_cloud_backups_local');
        const localList: CloudBackupRecord[] = localListRaw ? JSON.parse(localListRaw) : [];
        localList.unshift(backupPayload);
        localStorage.setItem('akademi_cloud_backups_local', JSON.stringify(localList));
        setCloudBackups(prev => [backupPayload, ...prev.filter(b => b.id !== backupId)]);
        return {
          success: true,
          message: `Yedek dosyası yerel hafızaya güvenle kaydedildi (${summary.studentCount} Öğrenci, ${summary.examCount} Sınav).`,
          backupId
        };
      }

      const backupRef = doc(db, 'schools', 'main', 'backups', backupId);
      await setDoc(backupRef, JSON.parse(JSON.stringify(backupPayload)));

      setCloudBackups(prev => [backupPayload, ...prev.filter(b => b.id !== backupId)]);

      return {
        success: true,
        message: `Yedek dosyası Firebase bulutuna başarıyla yüklendi (${summary.studentCount} Öğrenci, ${summary.examCount} Sınav).`,
        backupId
      };
    } catch (e: any) {
      if (e?.code === 'permission-denied') {
        handleFirestoreError(e, OperationType.WRITE, 'schools/main/backups');
      }
      return { success: false, message: e?.message || 'Buluta yükleme başarısız oldu.' };
    }
  };

  const restoreCloudBackup = async (backupId: string): Promise<{ success: boolean; message: string; summary?: any }> => {
    if (userRole !== 'admin') {
      return { success: false, message: 'Yedek geri yükleme yetkisi yalnızca yöneticilere aittir.' };
    }

    try {
      let targetBackup = cloudBackups.find(b => b.id === backupId);
      if (!targetBackup && auth.currentUser) {
        try {
          const snap = await getDoc(doc(db, 'schools', 'main', 'backups', backupId));
          if (snap.exists()) {
            targetBackup = snap.data() as CloudBackupRecord;
          }
        } catch (err: any) {
          if (err?.code === 'permission-denied') {
            handleFirestoreError(err, OperationType.GET, `schools/main/backups/${backupId}`);
          }
        }
      }

      if (!targetBackup || !targetBackup.data) {
        return { success: false, message: 'Belirtilen bulut yedeği bulunamadı veya veri içeriği hasarlı.' };
      }

      const res = await restoreBackup(targetBackup.data);
      if (res.success) {
        return {
          success: true,
          message: `"${targetBackup.name}" bulut yedeği başarıyla sisteme geri yüklendi ve Firebase ile eşitlendi!`,
          summary: res.summary
        };
      }
      return res;
    } catch (error: any) {
      console.error('Error restoring cloud backup:', error);
      return { success: false, message: error?.message || 'Bulut yedeği geri yüklenirken hata oluştu.' };
    }
  };

  const deleteCloudBackup = async (backupId: string): Promise<{ success: boolean; message: string }> => {
    if (userRole !== 'admin') {
      return { success: false, message: 'Yedek silme yetkisi yalnızca yöneticilere aittir.' };
    }
    if (!auth.currentUser) {
      const localListRaw = localStorage.getItem('akademi_cloud_backups_local');
      const localList: CloudBackupRecord[] = localListRaw ? JSON.parse(localListRaw) : [];
      const updated = localList.filter(b => b.id !== backupId);
      localStorage.setItem('akademi_cloud_backups_local', JSON.stringify(updated));
      setCloudBackups(prev => prev.filter(b => b.id !== backupId));
      return { success: true, message: 'Yedek silindi.' };
    }
    try {
      await deleteDoc(doc(db, 'schools', 'main', 'backups', backupId));
      setCloudBackups(prev => prev.filter(b => b.id !== backupId));
      return { success: true, message: 'Bulut yedeği Firebase üzerinden silindi.' };
    } catch (error: any) {
      if (error?.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.DELETE, `schools/main/backups/${backupId}`);
      }
      return { success: false, message: error?.message || 'Yedek silinemedi.' };
    }
  };

  const overwriteState = (newState: AppState) => {
    restoreBackup(newState);
  };

  return (
    <AppContext.Provider value={{ 
      state, 
      userRole, 
      syncStatus, 
      syncErrorMessage, 
      cloudBackups,
      isLoadingBackups,
      createCloudBackup,
      fetchCloudBackups,
      restoreCloudBackup,
      deleteCloudBackup,
      saveLocalBackupToCloud,
      setStudents, 
      setExams, 
      setResults, 
      setBudget, 
      setExamHalls, 
      updateBudget, 
      updateLeagueSettings, 
      approveTransfer, 
      updateExamKeys,
      updateExamOmr,
      saveOmrExamResults,
      deleteOmrExamResult,
      deleteAllOmrExamResults,
      updateUsers, 
      overwriteState,
      restoreBackup,
      saveNow,
      retrySync,
      checkAndRefreshRole,
      notifications,
      unreadNotificationsCount,
      isNotificationModalOpen,
      setIsNotificationModalOpen,
      openNotificationModal,
      markNotificationsAsSeen,
      sendPushNotification
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};
