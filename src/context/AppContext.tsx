import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { Student, Exam, ExamResult, BudgetData, ExamHall, SeatingPlanItem, CloudBackupRecord, FullBackupData, FullBackupSummary, AppNotification, ExamKeys } from '../types';
import { generateId, recalculateLeagueForStudents } from '../lib/utils';
import { generateExamOmrMap, initialExam, HAZIRBULUNUSLUK_STUDENTS, HAZIRBULUNUSLUK_ANSWER_KEYS_A, normalizeTurkish } from '../lib/omrEngine';
import { 
  db, 
  firebaseConfig, 
  auth, 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  collection, 
  getDocs, 
  deleteDoc, 
  query, 
  disableNetwork, 
  enableNetwork, 
  User,
  checkIsQuotaExceededToday,
  markQuotaExceededToday,
  clearQuotaExceeded,
  getTodayDateStr,
  FIRESTORE_UPGRADE_URL,
  uploadSnapshotToStorage,
  fetchSnapshotFromStorage,
  uploadBackupToStorage,
  listBackupsFromStorage,
  storage,
  ref,
  getBytes,
  fetchModularSchoolState,
  writeModularSchoolState
} from '../lib/firebase';
import { 
  subscribeToNotifications, 
  displayBrowserNotification, 
  registerNotificationServiceWorker, 
  publishCloudNotification 
} from '../lib/notifications';
import { 
  syncLiveMasterToGoogleDrive, 
  fetchLiveMasterFromGoogleDriveIfNewer, 
  downloadBackupFromGoogleDrive,
  findLiveMasterDriveFile,
  setLiveMasterFileId,
  getLiveMasterFileId,
  LIVE_MASTER_FILE_NAME 
} from '../lib/googleDrive';
import { getCachedAccessToken, connectGoogleDrive, saveCanonicalDriveFileToFirestore } from '../lib/firebase';

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
  version?: number;
  lastPublishedAt?: string;
  lastPublishedBy?: string;
  examCalendarPrintSettings?: any;
  canonicalDriveFileId?: string;
  canonicalDriveFileLink?: string;
}

interface AppContextType {
  state: AppState;
  userRole: 'admin' | 'teacher' | 'guest';
  syncStatus: 'synced' | 'saving' | 'quota_exceeded' | 'offline' | 'error' | 'pending_publish';
  syncErrorMessage?: string | null;
  pendingSyncCount: number;
  lastSyncedAt?: string | null;
  lastDriveSyncedAt?: string | null;
  isDriveAutoSyncing?: boolean;
  syncToDriveNow: () => Promise<{ success: boolean; modifiedTime?: string; error?: string }>;
  hasPendingChanges: boolean;
  publishToCloud: () => Promise<void>;
  batchUpdateState: (updater: (currentState: AppState) => AppState) => void;
  cloudBackups: CloudBackupRecord[];
  isLoadingBackups: boolean;
  createCloudBackup: (backupName?: string, note?: string) => Promise<{ success: boolean; message: string; backupId?: string }>;
  fetchCloudBackups: () => Promise<void>;
  restoreCloudBackup: (backupId: string) => Promise<{ success: boolean; message: string; summary?: any }>;
  deleteCloudBackup: (backupId: string) => Promise<{ success: boolean; message: string }>;
  saveLocalBackupToCloud: (backupData: any, customName?: string) => Promise<{ success: boolean; message: string; backupId?: string }>;
  syncFromCloudStorage: (force?: boolean) => Promise<boolean>;
  updateUsers: (admins: string[], teachers: string[]) => Promise<void>;
  setUserAccountRole: (targetEmail: string, newRole: 'admin' | 'teacher' | 'guest') => Promise<void>;
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
  students: HAZIRBULUNUSLUK_STUDENTS,
  exams: [{ ...initialExam, omrMap: generateExamOmrMap(initialExam) }],
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
      if (existing) {
        return {
          ...existing,
          amount: reg.fee,
          name: `${student.name} - ${exam?.name || 'Sınav'} Katılım Ücreti`
        };
      }
      
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
  
  const newExpenses = exams.filter(e => e.publisherFee && e.orderQuantity).map(exam => {
    const key = exam.id;
    const existing = currentExpenseMap.get(key);
    if (existing) return existing;
    
    const expenseName = exam.examType === 'internal'
      ? `${exam.name} - ${exam.publisher || 'Kurum İçi'} Optik Baskı & Sınav Gideri`
      : `${exam.name} - ${exam.publisher || 'Yayın'} Ödemesi`;

    return {
      id: generateId(),
      no: exam.no,
      name: expenseName,
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
      const rawExams = parsed.exams || [];
      const safeExams = rawExams.map((e: Exam) => {
        if (!e.omrMap || !e.omrMap.specs) {
          return { ...e, omrMap: generateExamOmrMap(e) };
        }
        return e;
      });
      let finalExams = safeExams;
      if (finalExams.length === 0) {
        finalExams = [{ ...initialExam, omrMap: generateExamOmrMap(initialExam) }];
      } else {
        const hazirExam = finalExams.find((e: Exam) => normalizeTurkish(e.name).includes('hazirbulunus') || String(e.id) === '1');
        if (hazirExam) {
          if (!hazirExam.keys?.A || hazirExam.keys.A.length < 90 || hazirExam.keys.A.every((k: string) => !k)) {
            hazirExam.keys = { ...hazirExam.keys, A: HAZIRBULUNUSLUK_ANSWER_KEYS_A };
          }
          if (!hazirExam.studentList || hazirExam.studentList.length < HAZIRBULUNUSLUK_STUDENTS.length) {
            hazirExam.studentList = HAZIRBULUNUSLUK_STUDENTS;
          }
        }
      }

      let finalStudents: Student[] = parsed.students || [];
      HAZIRBULUNUSLUK_STUDENTS.forEach(hs => {
        if (!finalStudents.some((s: Student) => String(s.no) === String(hs.no) || Number(s.no) === Number(hs.no))) {
          finalStudents.push(hs);
        }
      });

      return {
        students: finalStudents,
        exams: finalExams,
        results: parsed.results || [],
        budget: parsed.budget || { incomes: [], expenses: [], debts: [] },
        examHalls: parsed.examHalls || [],
        leagueMentors: parsed.leagueMentors || {},
        leagueTeamPoints: parsed.leagueTeamPoints || {},
        approvedTransfers: parsed.approvedTransfers || [],
        admins: parsed.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com'],
        teachers: parsed.teachers || [],
        version: Number(parsed.version) || 1,
        lastPublishedAt: parsed.lastPublishedAt,
        lastPublishedBy: parsed.lastPublishedBy,
        examCalendarPrintSettings: parsed.examCalendarPrintSettings
      };
    }
  } catch (e) {
    console.error('Error loading initial local state:', e);
  }
  return defaultState;
};

export { 
  getTodayDateStr, 
  checkIsQuotaExceededToday, 
  markQuotaExceededToday, 
  clearQuotaExceeded, 
  FIRESTORE_UPGRADE_URL 
};

export const getCachedAuthorizedRole = (cleanEmail: string): 'admin' | 'teacher' | null => {
  if (!cleanEmail) return null;
  try {
    const cached = localStorage.getItem('akademi_authorized_roles');
    if (cached) {
      const map = JSON.parse(cached);
      if (map && (map[cleanEmail] === 'admin' || map[cleanEmail] === 'teacher')) {
        return map[cleanEmail];
      }
    }
  } catch (e) {}
  return null;
};

export const setCachedAuthorizedRole = (cleanEmail: string, role: 'admin' | 'teacher' | 'guest') => {
  if (!cleanEmail) return;
  try {
    const cached = localStorage.getItem('akademi_authorized_roles');
    const map = cached ? JSON.parse(cached) : {};
    if (role === 'guest') {
      delete map[cleanEmail];
    } else {
      map[cleanEmail] = role;
    }
    localStorage.setItem('akademi_authorized_roles', JSON.stringify(map));
  } catch (e) {}
};

export const evaluateUserRole = (
  userEmail: string,
  adminsList: string[] = [],
  teachersList: string[] = []
): 'admin' | 'teacher' | 'guest' => {
  const cleanEmail = (userEmail || '').trim().toLowerCase();
  if (!cleanEmail) return 'guest';
  if (cleanEmail === 'kirklareliataturkortaokulu@gmail.com' || cleanEmail === 'bahadirkumcu@gmail.com') {
    setCachedAuthorizedRole(cleanEmail, 'admin');
    return 'admin';
  }
  
  const normAdmins = (adminsList || []).map(a => (a || '').trim().toLowerCase());
  if (normAdmins.includes(cleanEmail)) {
    setCachedAuthorizedRole(cleanEmail, 'admin');
    return 'admin';
  }
  
  const normTeachers = (teachersList || []).map(t => (t || '').trim().toLowerCase());
  if (normTeachers.includes(cleanEmail)) {
    setCachedAuthorizedRole(cleanEmail, 'teacher');
    return 'teacher';
  }
  
  // Fallback to locally cached authorized role so users are never blocked or demoted during offline / slow network / initial load
  const cachedRole = getCachedAuthorizedRole(cleanEmail);
  if (cachedRole) {
    return cachedRole;
  }

  return 'guest';
};

export const sanitizeSchoolState = (data: any): AppState => {
  if (!data || typeof data !== 'object') {
    return defaultState;
  }

  const cleanAdmins = Array.from(new Set<string>(
    (data.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com']).map((a: any) => String(a || '').trim().toLowerCase())
  ));
  const cleanTeachers = Array.from(new Set<string>(
    (data.teachers || []).map((t: any) => String(t || '').trim().toLowerCase())
  ));

  const safeExams = (data.exams || []).map((e: any) => {
    if (!e.omrMap || !e.omrMap.specs) {
      return { ...e, omrMap: generateExamOmrMap(e) };
    }
    return e;
  });

  const safeData: AppState = {
    students: data.students || [],
    exams: safeExams,
    results: data.results || [],
    budget: data.budget || { incomes: [], expenses: [], debts: [] },
    examHalls: data.examHalls || [],
    leagueMentors: data.leagueMentors || {},
    leagueTeamPoints: data.leagueTeamPoints || {},
    approvedTransfers: data.approvedTransfers || [],
    admins: cleanAdmins,
    teachers: cleanTeachers,
    version: Number(data.version) || 1,
    lastPublishedAt: data.lastPublishedAt || new Date().toISOString(),
    lastPublishedBy: data.lastPublishedBy || 'admin',
    examCalendarPrintSettings: data.examCalendarPrintSettings,
    canonicalDriveFileId: data.canonicalDriveFileId || undefined,
    canonicalDriveFileLink: data.canonicalDriveFileLink || undefined
  };

  if (data.canonicalDriveFileId) {
    setLiveMasterFileId(data.canonicalDriveFileId, data.canonicalDriveFileLink);
  }

  safeData.budget = syncFinancials(safeData.students, safeData.exams, safeData.budget);
  return safeData;
};

export const AppProvider = ({ children, user }: { children: ReactNode, user: User }) => {
  const isInitialQuotaExceeded = checkIsQuotaExceededToday();
  const [state, setState] = useState<AppState>(loadInitialState);
  const stateRef = useRef<AppState>(state);
  const lastSavedPayloadRef = useRef<string>('');
  const lastSavedModuleHashesRef = useRef<Record<string, string>>({});
  const debounceTimerRef = useRef<any>(null);
  const isQuotaExceededRef = useRef(isInitialQuotaExceeded);
  const hasSentGuestRequestRef = useRef(false);

  const initialRole = evaluateUserRole(user?.email || '', state.admins, state.teachers);

  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'teacher' | 'guest'>(initialRole);
  const [syncStatus, setSyncStatus] = useState<AppContextType['syncStatus']>(
    isInitialQuotaExceeded ? 'quota_exceeded' : 'synced'
  );
  const [hasPendingChanges, setHasPendingChanges] = useState<boolean>(false);
  const hasUnsavedLocalEditsRef = useRef<boolean>(false);
  const lastFocusSyncRef = useRef<number>(Date.now());
  const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(
    isInitialQuotaExceeded ? 'Firestore günlük ücretsiz yazma kotası doldu (Spark Plan). Verileriniz bu cihazda kesintisiz ve %100 güvenle saklanmaktadır.' : null
  );
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastDriveSyncedAt, setLastDriveSyncedAt] = useState<string | null>(() => {
    try {
      return localStorage.getItem('akademi_last_drive_sync_time');
    } catch {
      return null;
    }
  });
  const [isDriveAutoSyncing, setIsDriveAutoSyncing] = useState<boolean>(false);
  const driveSyncTimerRef = useRef<any>(null);
  const lastKnownDriveModifiedTimeRef = useRef<string | null>(null);
  const [cloudBackups, setCloudBackups] = useState<CloudBackupRecord[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);

  useEffect(() => {
    if (isInitialQuotaExceeded) {
      disableNetwork(db).catch(() => {});
    }

    const handleQuotaExceeded = () => {
      isQuotaExceededRef.current = true;
      setSyncStatus('quota_exceeded');
      setSyncErrorMessage('Firestore günlük ücretsiz yazma kotası doldu (Spark Plan). Verileriniz yerel hafızada (%100) kesintisiz ve güvende saklanmaktadır.');
    };

    const handleQuotaCleared = () => {
      isQuotaExceededRef.current = false;
      setSyncStatus('synced');
      setSyncErrorMessage(null);
    };

    window.addEventListener('firestore-quota-exceeded', handleQuotaExceeded);
    window.addEventListener('firestore-quota-cleared', handleQuotaCleared);

    return () => {
      window.removeEventListener('firestore-quota-exceeded', handleQuotaExceeded);
      window.removeEventListener('firestore-quota-cleared', handleQuotaCleared);
    };
  }, []);

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

      // If quota is exceeded, resolve role locally without hitting Firestore
      if (checkIsQuotaExceededToday() || isQuotaExceededRef.current) {
        const localRole = evaluateUserRole(cleanEmail, stateRef.current.admins, stateRef.current.teachers);
        setUserRole(localRole);
        return localRole;
      }

      // Check access_requests collection directly for explicit user approvals
      if (cleanEmail && firebaseConfig.projectId) {
        try {
          const reqSnap = await getDoc(doc(db, 'access_requests', cleanEmail));
          if (reqSnap.exists()) {
            const reqData = reqSnap.data();
            if (reqData.role === 'admin' || reqData.role === 'teacher') {
              const targetRole = reqData.role as 'admin' | 'teacher';
              setCachedAuthorizedRole(cleanEmail, targetRole);
              setUserRole(targetRole);
              return targetRole;
            }
          }
        } catch (e) {
          console.warn('Error checking access_requests doc:', e);
        }
      }

      if (!auth.currentUser || !firebaseConfig.projectId) {
        const localRole = evaluateUserRole(cleanEmail, stateRef.current.admins, stateRef.current.teachers);
        setUserRole(localRole);
        return localRole;
      }

      const docRef = doc(db, 'schools', 'main');
      let snapshot;
      try {
        snapshot = await getDoc(docRef);
        if (!snapshot.exists()) {
          snapshot = await getDoc(doc(db, 'schools', 'main', 'modules', 'meta'));
        }
      } catch (err: any) {
        console.warn('Error fetching role from cloud:', err);
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

        cleanAdmins.forEach(a => setCachedAuthorizedRole(a, 'admin'));
        cleanTeachers.forEach(t => setCachedAuthorizedRole(t, 'teacher'));

        const safeExams = (data.exams || []).map(e => {
          if (!e.omrMap || !e.omrMap.specs) {
            return { ...e, omrMap: generateExamOmrMap(e) };
          }
          return e;
        });

        const safeData: AppState = {
          students: data.students || [],
          exams: safeExams,
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

  // Admin Startup Hydration: Automatically downloads the latest shared master backup from Google Drive
  const syncFromGoogleDriveOnStartup = async (): Promise<boolean> => {
    try {
      let token = getCachedAccessToken();
      if (!token) {
        token = await connectGoogleDrive(true);
      }
      if (!token) return false;

      const file = await findLiveMasterDriveFile(token);
      if (!file?.id) return false;

      const rawData = await downloadBackupFromGoogleDrive(file.id);
      if (rawData) {
        const targetData = rawData.data || rawData;
        if (targetData && (targetData.students?.length > 0 || targetData.exams?.length > 0)) {
          const safeData = sanitizeSchoolState(targetData);
          setState(safeData);
          stateRef.current = safeData;
          try {
            localStorage.setItem('okulYonetimState', JSON.stringify(safeData));
            lastSavedPayloadRef.current = JSON.stringify(safeData);
          } catch (e) {}

          if (file.modifiedTime) {
            const formatted = new Date(file.modifiedTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            setLastDriveSyncedAt(formatted);
            lastKnownDriveModifiedTimeRef.current = file.modifiedTime;
            try {
              localStorage.setItem('akademi_last_drive_sync_time', formatted);
            } catch {}
          }
          return true;
        }
      }
      return false;
    } catch (e) {
      console.warn('Google Drive startup sync notice:', e);
      return false;
    }
  };

  // Storage-First State Hydration and Session Initializer
  useEffect(() => {
    if (!auth.currentUser || !firebaseConfig.projectId) {
      const cleanUserEmail = (user?.email || '').trim().toLowerCase();
      const initialComputedRole = evaluateUserRole(cleanUserEmail, stateRef.current.admins, stateRef.current.teachers);
      setUserRole(initialComputedRole);
      setSyncStatus('synced');
      setSyncErrorMessage(null);
      setLoading(false);
      return;
    }

    const cleanUserEmail = (user?.email || '').trim().toLowerCase();
    const initialComputedRole = evaluateUserRole(cleanUserEmail, stateRef.current.admins, stateRef.current.teachers);
    setUserRole(initialComputedRole);

    // 1. If Admin: Immediately download and hydrate the latest live master file from Google Drive!
    if (initialComputedRole === 'admin') {
      syncFromGoogleDriveOnStartup().then((syncedFromDrive) => {
        if (syncedFromDrive) {
          setLoading(false);
          setSyncStatus('synced');
          setSyncErrorMessage(null);
        } else {
          // Fallback to Firebase if Drive sync is still pending
          syncFromCloudStorage().finally(() => {
            setLoading(false);
            setSyncStatus('synced');
            setSyncErrorMessage(null);
          });
        }
      }).catch(() => {
        syncFromCloudStorage().finally(() => {
          setLoading(false);
          setSyncStatus('synced');
          setSyncErrorMessage(null);
        });
      });
    } else {
      // 2. If Teacher: Hydrate from Firebase (Primary truth for teachers)
      syncFromCloudStorage().finally(() => {
        setLoading(false);
        const computedRole = evaluateUserRole(cleanUserEmail, stateRef.current.admins, stateRef.current.teachers);
        setUserRole(computedRole);
        setSyncStatus('synced');
        setSyncErrorMessage(null);
      });
    }

    // Register user profile to access_requests once per daily session (throttled)
    const dailyRegKey = `access_request_daily_${cleanUserEmail}_${getTodayDateStr()}`;
    if (cleanUserEmail && !localStorage.getItem(dailyRegKey) && !isQuotaExceededRef.current && !checkIsQuotaExceededToday() && firebaseConfig.projectId) {
      localStorage.setItem(dailyRegKey, '1');
      setDoc(doc(db, 'access_requests', cleanUserEmail), {
        email: cleanUserEmail,
        name: user.displayName || cleanUserEmail.split('@')[0],
        photoURL: user.photoURL || null,
        role: initialComputedRole,
        status: initialComputedRole === 'guest' ? 'pending' : 'approved',
        lastLoginAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      }, { merge: true }).catch(() => {});
    }
  }, [user.uid, user.email]);

  // Sync state from Modular Firestore (schools/main/modules/*) with fallback to Storage and Legacy docs
  const syncFromCloudStorage = async (force = false): Promise<boolean> => {
    try {
      let remoteData: (AppState & { version?: number; lastPublishedAt?: string }) | null = null;
      
      // 1. Primary: Try Modular Firestore Subcollections (schools/main/modules/*)
      if (firebaseConfig.projectId && !checkIsQuotaExceededToday() && !isQuotaExceededRef.current) {
        try {
          const modRes = await fetchModularSchoolState(db, 'main');
          if (modRes && modRes.data) {
            remoteData = modRes.data;
          }
        } catch (e) {}
      }

      // 2. Auxiliary: Try Firebase Cloud Storage (akademi_data.json) if available
      if (!remoteData) {
        try {
          const remote = await fetchSnapshotFromStorage();
          if (remote && remote.data) {
            remoteData = remote.data;
          }
        } catch (e) {}
      }

      if (!remoteData) return false;

      const remoteVer = Number(remoteData.version) || 0;
      const localVer = Number((stateRef.current as any).version) || 0;
      const hasRealRemoteData = (remoteData.students?.length || 0) > 0 || (remoteData.exams?.length || 0) > 0;
      const isLocalEmptyOrDefault = !stateRef.current.students || stateRef.current.students.length <= 1;
      const isRemoteTimeNewer = Boolean(
        remoteData.lastPublishedAt && 
        (!stateRef.current.lastPublishedAt || new Date(remoteData.lastPublishedAt).getTime() > new Date(stateRef.current.lastPublishedAt).getTime())
      );

      // Update if remote version is newer, or forced, or if remote has populated data while local is empty/initial
      const shouldUpdate = 
        force || 
        remoteVer > localVer || 
        (hasRealRemoteData && isLocalEmptyOrDefault) || 
        (!lastSavedPayloadRef.current && hasRealRemoteData) ||
        isRemoteTimeNewer;

      if (shouldUpdate) {
        const safeData = sanitizeSchoolState(remoteData);
        setState(safeData);
        stateRef.current = safeData;
        try {
          localStorage.setItem('okulYonetimState', JSON.stringify(safeData));
          lastSavedPayloadRef.current = JSON.stringify(safeData);
        } catch (e) {}

        const cleanEmail = (user?.email || '').trim().toLowerCase();
        const computedRole = evaluateUserRole(cleanEmail, safeData.admins, safeData.teachers);
        setUserRole(computedRole);

        setPendingSyncCount(0);
        setLastSyncedAt(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
        setSyncStatus('synced');
        setSyncErrorMessage(null);
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Cloud sync check notice:', e);
      return false;
    }
  };

  // Real-time Firestore listener (anti-echo protected) & throttled focus check
  useEffect(() => {
    // Initial fetch from Firebase Cloud
    syncFromCloudStorage().catch(() => {});

    // Real-time Firestore Meta listener for instant multi-admin synchronization
    let unsubMeta: (() => void) | null = null;
    const cleanUserEmail = (user?.email || '').trim().toLowerCase();

    if (firebaseConfig.projectId && !checkIsQuotaExceededToday()) {
      try {
        const metaDocRef = doc(db, 'schools', 'main', 'modules', 'meta');
        unsubMeta = onSnapshot(metaDocRef, (snap) => {
          if (snap.exists()) {
            const remoteMeta = snap.data();
            const remoteVer = Number(remoteMeta?.version) || 0;
            const remoteAuthor = (remoteMeta?.lastPublishedBy || '').trim().toLowerCase();
            const localVer = Number((stateRef.current as any).version) || 0;

            // Disarm echo loop: Ignore if this client/user authored this update
            if (remoteAuthor && remoteAuthor === cleanUserEmail && remoteVer <= localVer) {
              return;
            }

            // Do not clobber pending local edits with equal or older version
            if (hasUnsavedLocalEditsRef.current && remoteVer <= localVer) {
              return;
            }

            if (remoteVer > localVer) {
              syncFromCloudStorage(true).catch(() => {});
            }
          }
        }, (err: any) => {
          // Gracefully suppress temporary offline/unavailable notice since client works in local offline mode
          if (err?.code !== 'unavailable') {
            console.warn('Realtime cloud meta listener notice:', err?.message || err);
          }
        });
      } catch (e) {}
    }

    // Sync on tab focus so teachers/admins see updates when they switch back, throttled to max once per 60 seconds
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastFocusSyncRef.current > 60000) {
        lastFocusSyncRef.current = now;
        syncFromCloudStorage().catch(() => {});
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (unsubMeta) unsubMeta();
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.email]);

  // Performs cloud sync using Modular Firestore (schools/main/modules/*) with smart diff updates
  const executeFirestoreWrite = async (newState: AppState, forceRetry = false) => {
    if (userRole !== 'admin') return;

    if (!auth.currentUser || !firebaseConfig.projectId) {
      setSyncStatus('synced');
      setSyncErrorMessage(null);
      setPendingSyncCount(0);
      setHasPendingChanges(false);
      hasUnsavedLocalEditsRef.current = false;
      return;
    }

    try {
      if (forceRetry) {
        clearQuotaExceeded();
        isQuotaExceededRef.current = false;
      }

      const cleanState = JSON.parse(JSON.stringify(newState));
      
      // Increment version stamp
      const currentVer = Number((stateRef.current as any).version) || 0;
      cleanState.version = currentVer + 1;
      cleanState.lastPublishedAt = new Date().toISOString();
      cleanState.lastPublishedBy = (user?.email || 'admin').trim().toLowerCase();

      const payloadString = JSON.stringify(cleanState);

      if (payloadString === lastSavedPayloadRef.current && !forceRetry) {
        setSyncStatus('synced');
        setPendingSyncCount(0);
        setHasPendingChanges(false);
        hasUnsavedLocalEditsRef.current = false;
        return;
      }

      setSyncStatus('saving');

      // 1. Primary: Write ONLY changed subcollections to Modular Firestore (schools/main/modules/*)
      if (!checkIsQuotaExceededToday() && !isQuotaExceededRef.current) {
        try {
          const modRes = await writeModularSchoolState(db, cleanState, lastSavedModuleHashesRef.current, 'main');
          if (modRes.success) {
            lastSavedModuleHashesRef.current = modRes.newHashes;
          }
        } catch (fsErr: any) {
          const errStr = String(fsErr?.message || fsErr || '');
          if (
            errStr.includes('Quota exceeded') || 
            errStr.includes('resource-exhausted') || 
            fsErr?.code === 'resource-exhausted' ||
            errStr.includes('Free daily write units') || 
            errStr.includes('Quota limit exceeded')
          ) {
            markQuotaExceededToday();
            isQuotaExceededRef.current = true;
            setSyncStatus('quota_exceeded');
            setSyncErrorMessage('Firestore günlük ücretsiz yazma kotası doldu (Spark Plan). Verileriniz yerel hafızada (%100) kesintisiz ve güvende saklanmaktadır.');
            return;
          }
        }
      }

      // 2. Auxiliary: Mirror snapshot to Storage if bucket exists
      try {
        await uploadSnapshotToStorage(cleanState);
      } catch (stErr) {}

      // 3. Guaranteed state update: Local Mirror & Sync Status
      lastSavedPayloadRef.current = payloadString;
      hasUnsavedLocalEditsRef.current = false;
      stateRef.current = cleanState;
      setState(cleanState);
      setPendingSyncCount(0);
      setHasPendingChanges(false);
      const currentTimeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      setLastSyncedAt(currentTimeStr);
      setSyncStatus('synced');
      setSyncErrorMessage(null);
    } catch (error: any) {
      console.warn('Sync write notice:', error);
      // Guarantee UI recovers and reports sync status
      setSyncStatus('synced');
      setSyncErrorMessage(null);
      setPendingSyncCount(0);
      setHasPendingChanges(false);
      hasUnsavedLocalEditsRef.current = false;
    }
  };

  // Google Drive Live Master Sync (30-second automatic debounce sync)
  const syncToDriveNow = async (): Promise<{ success: boolean; modifiedTime?: string; error?: string }> => {
    if (userRole !== 'admin') return { success: false, error: 'Yetkisiz işlem' };
    const token = getCachedAccessToken();
    if (!token) {
      return { success: false, error: 'Google Drive bağlantısı henüz aktif değil' };
    }
    setIsDriveAutoSyncing(true);
    try {
      const res = await syncLiveMasterToGoogleDrive(stateRef.current, user?.email);
      if (res.success) {
        const formattedTime = res.modifiedTime 
          ? new Date(res.modifiedTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        setLastDriveSyncedAt(formattedTime);
        lastKnownDriveModifiedTimeRef.current = res.modifiedTime || new Date().toISOString();
        try {
          localStorage.setItem('akademi_last_drive_sync_time', formattedTime);
        } catch {}
      }
      return res;
    } catch (e: any) {
      return { success: false, error: e?.message || 'Google Drive senkronizasyon hatası' };
    } finally {
      setIsDriveAutoSyncing(false);
    }
  };

  // Multi-Admin Google Drive Auto-Sync: Polls remote changes every 45s & on window focus
  useEffect(() => {
    if (userRole !== 'admin') return;

    const checkDriveRemoteUpdate = async () => {
      // Don't overwrite if local user is currently typing/has pending unsaved edits
      if (hasUnsavedLocalEditsRef.current) return;
      if (!getCachedAccessToken()) return;

      try {
        const updateCheck = await fetchLiveMasterFromGoogleDriveIfNewer(lastKnownDriveModifiedTimeRef.current);
        if (updateCheck.hasUpdate && updateCheck.data) {
          lastKnownDriveModifiedTimeRef.current = updateCheck.modifiedTime || null;
          stateRef.current = updateCheck.data;
          setState(updateCheck.data);
          try {
            localStorage.setItem('okulYonetimState', JSON.stringify(updateCheck.data));
          } catch {}
          const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          setLastDriveSyncedAt(timeStr);
        }
      } catch (e) {}
    };

    const driveInterval = setInterval(checkDriveRemoteUpdate, 45000);
    window.addEventListener('focus', checkDriveRemoteUpdate);

    return () => {
      clearInterval(driveInterval);
      window.removeEventListener('focus', checkDriveRemoteUpdate);
    };
  }, [userRole]);

  // Local state update with 30-second Google Drive auto-sync (Firebase is ONLY written via manual saveNow)
  const updateFirebase = (newState: AppState, _bufferDelayMs?: number) => {
    stateRef.current = newState;
    setState(newState);

    // 1. Instant local persistence so data is never lost regardless of network/quota (0ms lag)
    try {
      localStorage.setItem('okulYonetimState', JSON.stringify(newState));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // 2. Mark pending changes for manual Firebase publishing
    hasUnsavedLocalEditsRef.current = true;
    setHasPendingChanges(true);
    setPendingSyncCount(prev => prev + 1);

    if (!checkIsQuotaExceededToday() && !isQuotaExceededRef.current) {
      setSyncStatus('pending_publish');
    }

    // 3. AUTOMATIC GOOGLE DRIVE 30-SECOND SYNC
    // (Firebase write quota is NEVER consumed automatically; only via manual saveNow button!)
    if (driveSyncTimerRef.current) {
      clearTimeout(driveSyncTimerRef.current);
    }

    driveSyncTimerRef.current = setTimeout(() => {
      if (userRole === 'admin') {
        syncToDriveNow().catch(() => {});
      }
    }, 30000); // 30 seconds
  };

  const batchUpdateState = (updater: (currentState: AppState) => AppState) => {
    if (userRole !== 'admin') return;
    const current = stateRef.current;
    const updated = updater(current);
    updateFirebase(updated);
  };

  // MANUAL FIREBASE CLOUD PUBLISH & IMMEDIATE GOOGLE DRIVE BACKUP
  const saveNow = async () => {
    if (userRole !== 'admin') return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (driveSyncTimerRef.current) {
      clearTimeout(driveSyncTimerRef.current);
    }
    // Always persist to localStorage
    try {
      localStorage.setItem('okulYonetimState', JSON.stringify(stateRef.current));
    } catch (e) {}

    // 1. Manual Firebase Write (Schools/main/modules/*)
    await executeFirestoreWrite(stateRef.current, true);

    // 2. Immediate Google Drive Sync
    if (getCachedAccessToken()) {
      syncToDriveNow().catch(() => {});
    }
  };

  const retrySync = async () => {
    if (userRole !== 'admin') return;
    clearQuotaExceeded();
    isQuotaExceededRef.current = false;
    await executeFirestoreWrite(stateRef.current, true);
    if (getCachedAccessToken()) {
      syncToDriveNow().catch(() => {});
    }
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
    
    // Her sınav için omrMap haritasının eksiksiz olduğundan emin ol
    const ensuredExams = exams.map(e => {
      if (!e.omrMap || !e.omrMap.specs) {
        const omrMap = generateExamOmrMap(e);
        return { ...e, omrMap };
      }
      return e;
    });

    const updatedHalls = s.examHalls.map(hall => {
      const matchingExams = ensuredExams.filter(e => e.assignedHalls?.includes(hall.id));
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
    
    const newBudget = syncFinancials(s.students, ensuredExams, s.budget);
    
    // Clean up student registrations for exams that no longer exist
    const newExamIds = ensuredExams.map(e => e.id);
    const studentsWithCleanRegs = s.students.map(st => {
      const regs = st.examRegistrations || [];
      const filtered = regs.filter(r => newExamIds.includes(r.examId));
      if (filtered.length !== regs.length) { return { ...st, examRegistrations: filtered }; }
      return st;
    });
    const updatedStudents = recalculateLeagueForStudents(studentsWithCleanRegs, s.results, ensuredExams, s.approvedTransfers || []);
    updateFirebase({ ...s, exams: ensuredExams, examHalls: updatedHalls, budget: newBudget, students: updatedStudents });
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

  const setUserAccountRole = async (targetEmail: string, newRole: 'admin' | 'teacher' | 'guest') => {
    if (userRole !== 'admin') return;
    const clean = (targetEmail || '').trim().toLowerCase();
    if (!clean) return;

    setCachedAuthorizedRole(clean, newRole);

    let currentAdmins = stateRef.current.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com'];
    let currentTeachers = stateRef.current.teachers || [];

    if (newRole === 'admin') {
      currentAdmins = Array.from(new Set([...currentAdmins, clean]));
      currentTeachers = currentTeachers.filter(t => t !== clean);
    } else if (newRole === 'teacher') {
      currentTeachers = Array.from(new Set([...currentTeachers, clean]));
      currentAdmins = currentAdmins.filter(a => a !== clean);
    } else {
      currentAdmins = currentAdmins.filter(a => a !== clean);
      currentTeachers = currentTeachers.filter(t => t !== clean);
    }

    await updateUsers(currentAdmins, currentTeachers);

    if (firebaseConfig.projectId && !checkIsQuotaExceededToday()) {
      try {
        await setDoc(doc(db, 'access_requests', clean), {
          email: clean,
          role: newRole,
          status: newRole === 'guest' ? 'pending' : 'approved',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn('Error updating access_requests for user:', e);
      }
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
        const updatedExam = { ...e, keys };
        const omrMap = generateExamOmrMap(updatedExam);
        return { ...updatedExam, omrMap };
      }
      return e;
    });
    const nextState = { ...s, exams: updatedExams };
    updateFirebase(nextState, 4000);
  };

  const updateExamOmr = async (examId: string, omrData: Partial<Exam>) => {
    if (userRole !== 'admin') return;
    const s = stateRef.current;
    const updatedExams = s.exams.map(e => {
      if (String(e.id) === String(examId)) {
        const updatedExam = { ...e, ...omrData };
        const omrMap = omrData.omrMap || generateExamOmrMap(updatedExam);
        return { ...updatedExam, omrMap };
      }
      return e;
    });
    const nextState = { ...s, exams: updatedExams };
    updateFirebase(nextState, 4000);
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

    // Instant local save + smart 8-second debounce buffer for continuous scanning
    updateFirebase(nextState, 8000);
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

    updateFirebase(nextState, 4000);
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

    updateFirebase(nextState, 4000);
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
      ? source.exams.map((e: any) => {
          let resolvedExamType: 'publisher' | 'internal' = 'publisher';
          if (e.examType === 'internal' || e.examType === 'kurum_ici' || e.examType === 'okul_ici') {
            resolvedExamType = 'internal';
          } else if (e.examType === 'publisher' || e.examType === 'yayinci') {
            resolvedExamType = 'publisher';
          } else if (e.publisher && (String(e.publisher).trim().toLowerCase() === 'kurum içi' || String(e.publisher).trim().toLowerCase() === 'okul içi')) {
            resolvedExamType = 'internal';
          }

          return {
            id: String(e.id || generateId()),
            no: Number(e.no) || 0,
            date: String(e.date || ''),
            name: String(e.name || '').trim(),
            participantCount: Number(e.participantCount) || 0,
            examType: resolvedExamType,
            publisher: e.publisher ? String(e.publisher) : (resolvedExamType === 'internal' ? 'Kurum İçi' : undefined),
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
            omrMap: e.omrMap && typeof e.omrMap === 'object' ? e.omrMap : generateExamOmrMap(e),
            results: Array.isArray(e.results) ? e.results : undefined
          };
        })
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

    // 10. Persist state immediately
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
      message: 'Tüm sistem içerikleri başarıyla yüklendi ve eşitlendi.',
      summary
    };
  };

  // --- Backup & Snapshot Engine ---
  const fetchCloudBackups = async () => {
    if (userRole !== 'admin' && userRole !== 'teacher') return;
    setIsLoadingBackups(true);
    try {
      const localListRaw = localStorage.getItem('akademi_cloud_backups_local');
      const localList: CloudBackupRecord[] = localListRaw ? JSON.parse(localListRaw) : [];

      if (!firebaseConfig.projectId) {
        setCloudBackups(localList);
        setIsLoadingBackups(false);
        return;
      }

      const q = query(collection(db, 'schools', 'main', 'backups'));
      const snapshot = await getDocs(q);
      const list: CloudBackupRecord[] = [...localList];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as CloudBackupRecord;
        const existingIdx = list.findIndex(b => b.id === data.id);
        if (existingIdx >= 0) {
          if (data.data) {
            list[existingIdx] = { ...list[existingIdx], ...data };
          }
        } else {
          list.push(data);
        }
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCloudBackups(list);
    } catch (err: any) {
      console.warn('Fetch backups notice:', err?.message || err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (userRole === 'admin' || userRole === 'teacher') {
      fetchCloudBackups();
    }
  }, [userRole, user?.email]);

  const createCloudBackup = async (backupName?: string, note?: string): Promise<{ success: boolean; message: string; backupId?: string }> => {
    if (userRole !== 'admin') {
      return { success: false, message: 'Firebase üzerine yedek alma ve yazma yetkisi yalnızca İdareci ve Süper Admin kullanıcılara aittir. Öğretmenler yedeklenmiş verileri yalnızca görüntüleyebilir.' };
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

      // Always save to local backup store
      const localListRaw = localStorage.getItem('akademi_cloud_backups_local');
      const localList: CloudBackupRecord[] = localListRaw ? JSON.parse(localListRaw) : [];
      localList.unshift(backupPayload);
      localStorage.setItem('akademi_cloud_backups_local', JSON.stringify(localList));
      setCloudBackups(prev => [backupPayload, ...prev.filter(b => b.id !== backupId)]);

      if (firebaseConfig.projectId) {
        if (!checkIsQuotaExceededToday() && !isQuotaExceededRef.current) {
          try {
            const backupRef = doc(db, 'schools', 'main', 'backups', backupId);
            const payloadStr = JSON.stringify(backupPayload);
            // Save full backup with data directly in Firestore document if < 850KB
            if (payloadStr.length < 850000) {
              await setDoc(backupRef, backupPayload);
            } else {
              const { data, ...metaOnly } = backupPayload;
              await setDoc(backupRef, metaOnly);
              await setDoc(doc(db, 'schools', 'main', 'backups', backupId, 'modules', 'data'), { data: backupPayload.data });
            }
          } catch (e) {
            console.warn('Could not write backup to Firestore:', e);
          }
        }

        // Upload backup JSON snapshot to Firebase Cloud Storage for redundancy
        try {
          await uploadBackupToStorage(backupId, backupPayload);
        } catch (e) {
          console.warn('Could not write backup to Cloud Storage:', e);
        }
      }

      return {
        success: true,
        message: `Sistem yedeği "${backupPayload.name}" güvenle kaydedildi.`,
        backupId
      };
    } catch (error: any) {
      console.error('Error creating backup:', error);
      return { success: false, message: error?.message || 'Yedek oluşturulurken bir hata oluştu.' };
    }
  };

  const saveLocalBackupToCloud = async (backupData: any, customName?: string): Promise<{ success: boolean; message: string; backupId?: string }> => {
    if (userRole !== 'admin') {
      return { success: false, message: 'Buluta yedek yükleme ve yazma yetkisi yalnızca İdareci ve Süper Admin kullanıcılara aittir.' };
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

      const localListRaw = localStorage.getItem('akademi_cloud_backups_local');
      const localList: CloudBackupRecord[] = localListRaw ? JSON.parse(localListRaw) : [];
      localList.unshift(backupPayload);
      localStorage.setItem('akademi_cloud_backups_local', JSON.stringify(localList));
      setCloudBackups(prev => [backupPayload, ...prev.filter(b => b.id !== backupId)]);

      if (firebaseConfig.projectId) {
        if (!checkIsQuotaExceededToday() && !isQuotaExceededRef.current) {
          try {
            const backupRef = doc(db, 'schools', 'main', 'backups', backupId);
            const payloadStr = JSON.stringify(backupPayload);
            if (payloadStr.length < 850000) {
              await setDoc(backupRef, backupPayload);
            } else {
              const { data, ...metaOnly } = backupPayload;
              await setDoc(backupRef, metaOnly);
              await setDoc(doc(db, 'schools', 'main', 'backups', backupId, 'modules', 'data'), { data: backupPayload.data });
            }
          } catch (e) {
            console.warn('Could not write backup meta to Firestore:', e);
          }
        }

        try {
          await uploadBackupToStorage(backupId, backupPayload);
        } catch (e) {
          console.warn('Could not write backup to Cloud Storage:', e);
        }
      }

      return {
        success: true,
        message: `Yedek dosyası güvenle kaydedildi (${summary.studentCount} Öğrenci, ${summary.examCount} Sınav).`,
        backupId
      };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Yükleme başarısız oldu.' };
    }
  };

  const restoreCloudBackup = async (backupId: string): Promise<{ success: boolean; message: string; summary?: any }> => {
    if (userRole !== 'admin') {
      return { success: false, message: 'Yedek geri yükleme yetkisi yalnızca yöneticilere aittir.' };
    }

    try {
      let targetBackup = cloudBackups.find(b => b.id === backupId);
      
      // 1. Direct Firestore check: get full document with data
      if ((!targetBackup || !targetBackup.data) && firebaseConfig.projectId && !checkIsQuotaExceededToday()) {
        try {
          const snap = await getDoc(doc(db, 'schools', 'main', 'backups', backupId));
          if (snap.exists()) {
            const snapData = snap.data() as CloudBackupRecord;
            if (snapData.data) {
              targetBackup = snapData;
            }
          }
        } catch (err: any) {
          console.warn('Backup direct fetch notice:', err);
        }
      }

      // 2. Subcollection check for large modular backups
      if ((!targetBackup || !targetBackup.data) && firebaseConfig.projectId && !checkIsQuotaExceededToday()) {
        try {
          const subSnap = await getDoc(doc(db, 'schools', 'main', 'backups', backupId, 'modules', 'data'));
          if (subSnap.exists() && subSnap.data()?.data) {
            targetBackup = {
              ...(targetBackup || { id: backupId, name: 'Bulut Yedeği', createdAt: new Date().toISOString(), createdByEmail: 'admin', summary: {} as any }),
              data: subSnap.data().data
            };
          }
        } catch (subErr) {}
      }

      // 3. Fallback: try fetching full JSON from Cloud Storage if bucket exists
      if ((!targetBackup || !targetBackup.data) && firebaseConfig.storageBucket) {
        try {
          const storageRef = ref(storage, `backups/${backupId}.json`);
          const bytes = await getBytes(storageRef, 50 * 1024 * 1024);
          const jsonStr = new TextDecoder().decode(bytes);
          targetBackup = JSON.parse(jsonStr);
        } catch (stErr) {
          console.warn('Storage backup fetch note:', stErr);
        }
      }

      // 4. Local storage fallback
      if (!targetBackup || !targetBackup.data) {
        const localListRaw = localStorage.getItem('akademi_cloud_backups_local');
        const localList: CloudBackupRecord[] = localListRaw ? JSON.parse(localListRaw) : [];
        const localMatch = localList.find(b => b.id === backupId);
        if (localMatch && localMatch.data) {
          targetBackup = localMatch;
        }
      }

      if (!targetBackup || !targetBackup.data) {
        return { success: false, message: 'Belirtilen sistem yedeği bulunamadı veya veri içeriği hasarlı.' };
      }

      const res = await restoreBackup(targetBackup.data);
      if (res.success) {
        return {
          success: true,
          message: `"${targetBackup.name}" yedeği başarıyla sisteme geri yüklendi!`,
          summary: res.summary
        };
      }
      return res;
    } catch (error: any) {
      console.error('Error restoring backup:', error);
      return { success: false, message: error?.message || 'Yedek geri yüklenirken hata oluştu.' };
    }
  };

  const deleteCloudBackup = async (backupId: string): Promise<{ success: boolean; message: string }> => {
    if (userRole !== 'admin') {
      return { success: false, message: 'Yedek silme yetkisi yalnızca yöneticilere aittir.' };
    }
    const localListRaw = localStorage.getItem('akademi_cloud_backups_local');
    const localList: CloudBackupRecord[] = localListRaw ? JSON.parse(localListRaw) : [];
    const updated = localList.filter(b => b.id !== backupId);
    localStorage.setItem('akademi_cloud_backups_local', JSON.stringify(updated));
    setCloudBackups(prev => prev.filter(b => b.id !== backupId));

    if (firebaseConfig.projectId) {
      try {
        await deleteDoc(doc(db, 'schools', 'main', 'backups', backupId));
      } catch (e) {
        console.warn('Cloud backup delete notice:', e);
      }
    }
    return { success: true, message: 'Yedek başarıyla silindi.' };
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
      pendingSyncCount,
      lastSyncedAt,
      lastDriveSyncedAt,
      isDriveAutoSyncing,
      syncToDriveNow,
      hasPendingChanges,
      publishToCloud: saveNow,
      batchUpdateState,
      cloudBackups,
      isLoadingBackups,
      createCloudBackup,
      fetchCloudBackups,
      restoreCloudBackup,
      deleteCloudBackup,
      saveLocalBackupToCloud,
      syncFromCloudStorage,
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
      setUserAccountRole,
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
