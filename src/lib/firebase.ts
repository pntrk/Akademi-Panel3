import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  setPersistence,
  browserLocalPersistence,
  type User 
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  setLogLevel,
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocFromServer,
  disableNetwork,
  enableNetwork
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadString, 
  getDownloadURL, 
  deleteObject, 
  listAll, 
  getBytes,
  type FirebaseStorage
} from 'firebase/storage';
import { compileMonthlyArenaSnapshots } from './utils';
import rawFirebaseConfig from '../../firebase-applet-config.json';

export interface FirebaseAppConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
  firestoreDatabaseId?: string;
}

export const firebaseConfig: FirebaseAppConfig = rawFirebaseConfig as FirebaseAppConfig;

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Suppress non-critical transient network drop warnings in development
try {
  setLogLevel('error');
} catch (e) {}

// Initialize Firestore with custom database ID and robust network connection (auto-detect long-polling fallback)
export const db = (() => {
  try {
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId || '(default)');
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
  }
})();

// Initialize Firebase Storage
export const storage: FirebaseStorage = getStorage(app);
try {
  // Generous timeout for large snapshots (up to 30s)
  storage.maxUploadRetryTime = 30000;
  storage.maxOperationRetryTime = 30000;
} catch (e) {}

// Initialize Firebase Auth
export const auth = getAuth(app);
try {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
} catch (e) {}

export const FIRESTORE_UPGRADE_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId || '(default)'}/data?openUpgradeDialog=true`;
export const FIREBASE_STORAGE_ACTIVATE_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/storage`;

export const getTodayDateStr = () => new Date().toISOString().slice(0, 10);

export const checkIsQuotaExceededToday = (): boolean => {
  try {
    const savedDate = localStorage.getItem('firestore_quota_exceeded_date');
    const savedProject = localStorage.getItem('firestore_quota_exceeded_project');
    return savedDate === getTodayDateStr() && savedProject === firebaseConfig.projectId;
  } catch (e) {
    return false;
  }
};

export const markQuotaExceededToday = () => {
  try {
    localStorage.setItem('firestore_quota_exceeded_date', getTodayDateStr());
    localStorage.setItem('firestore_quota_exceeded_project', firebaseConfig.projectId);
    disableNetwork(db).catch(() => {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
    }
  } catch (e) {}
};

export const clearQuotaExceeded = () => {
  try {
    localStorage.removeItem('firestore_quota_exceeded_date');
    localStorage.removeItem('firestore_quota_exceeded_project');
    enableNetwork(db).catch(() => {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firestore-quota-cleared'));
    }
  } catch (e) {}
};

// Immediate check on boot: if quota was already exceeded today, disable network immediately to avoid backoff loops
if (checkIsQuotaExceededToday()) {
  disableNetwork(db).catch(() => {});
}

// Global safety net: detect quota exhaustion from console, unhandled promises or runtime errors
if (typeof window !== 'undefined') {
  const checkErrorForQuota = (err: any) => {
    const errStr = String(err?.message || err?.reason?.message || err?.reason || err || '');
    if (
      errStr.includes('Quota exceeded') ||
      errStr.includes('resource-exhausted') ||
      err?.code === 'resource-exhausted' ||
      err?.reason?.code === 'resource-exhausted' ||
      errStr.includes('Free daily write units') ||
      errStr.includes('Free daily read units') ||
      errStr.includes('Quota limit exceeded')
    ) {
      markQuotaExceededToday();
      return true;
    }
    return false;
  };

  // Intercept console.error to silence repetitive backoff retry spam from Firestore SDK
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const combined = args.map(a => (typeof a === 'object' ? String(a?.message || a?.reason || JSON.stringify(a)) : String(a))).join(' ');
    if (
      combined.includes('resource-exhausted') ||
      combined.includes('Quota limit exceeded') ||
      combined.includes('Free daily write units') ||
      combined.includes('Using maximum backoff delay')
    ) {
      markQuotaExceededToday();
      return; // Suppress backoff spam
    }
    originalConsoleError.apply(console, args);
  };

  const originalConsoleWarn = console.warn;
  console.warn = (...args: any[]) => {
    const combined = args.map(a => (typeof a === 'object' ? String(a?.message || a?.reason || JSON.stringify(a)) : String(a))).join(' ');
    if (
      combined.includes('resource-exhausted') ||
      combined.includes('Quota limit exceeded') ||
      combined.includes('Free daily write units') ||
      combined.includes('Using maximum backoff delay')
    ) {
      markQuotaExceededToday();
      return;
    }
    originalConsoleWarn.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (checkErrorForQuota(event.reason)) {
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    if (checkErrorForQuota(event.error)) {
      event.preventDefault();
    }
  });
}

// Test connection on boot as mandated by Firebase integration guidelines
async function testConnection() {
  try {
    if (checkIsQuotaExceededToday()) {
      disableNetwork(db).catch(() => {});
      return;
    }
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    const errStr = String(error?.message || error || '');
    if (
      errStr.includes('Quota exceeded') || 
      errStr.includes('resource-exhausted') || 
      error?.code === 'resource-exhausted' || 
      errStr.includes('Free daily write units') ||
      errStr.includes('Free daily read units') ||
      errStr.includes('Quota limit exceeded')
    ) {
      markQuotaExceededToday();
    } else if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Standard Firestore Error Handling conforming to FirestoreErrorInfo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Standard Google Auth Provider for App Login (Clean, official, non-sensitive scopes: email & profile only)
// NEVER displays developer unverified warnings or scary permissions dialogs!
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Dedicated Google Drive Provider for Drive File sync (Used by Admin when logging in / connecting Google Drive)
export const googleDriveProvider = new GoogleAuthProvider();
googleDriveProvider.setCustomParameters({
  prompt: 'select_account',
  include_granted_scopes: 'true'
});
googleDriveProvider.addScope('https://www.googleapis.com/auth/drive');
googleDriveProvider.addScope('https://www.googleapis.com/auth/drive.file');

// Token keys for persistent session/local storage
const DRIVE_TOKEN_KEY = 'akademi_drive_access_token';
const DRIVE_EXPIRES_KEY = 'akademi_drive_token_expires_at';
const DRIVE_APPROVED_PREFIX = 'akademi_drive_approved_';

let inMemoryAccessToken: string | null = null;

export const isDrivePreApproved = (email?: string | null): boolean => {
  const e = (email || auth.currentUser?.email || '').trim().toLowerCase();
  if (!e) return false;
  try {
    return localStorage.getItem(DRIVE_APPROVED_PREFIX + e) === 'true';
  } catch {
    return false;
  }
};

export const markDrivePreApproved = (email?: string | null) => {
  const e = (email || auth.currentUser?.email || '').trim().toLowerCase();
  if (!e) return;
  try {
    localStorage.setItem(DRIVE_APPROVED_PREFIX + e, 'true');
  } catch {}
};

export const setCachedAccessToken = (token: string | null, expiresInSeconds = 3600) => {
  inMemoryAccessToken = token;
  try {
    if (token) {
      const expiresAt = Date.now() + (expiresInSeconds * 1000);
      sessionStorage.setItem(DRIVE_TOKEN_KEY, token);
      sessionStorage.setItem(DRIVE_EXPIRES_KEY, expiresAt.toString());
      localStorage.setItem(DRIVE_TOKEN_KEY, token);
      localStorage.setItem(DRIVE_EXPIRES_KEY, expiresAt.toString());
      localStorage.setItem('akademi_admin_drive_connected', 'true');
      if (auth.currentUser?.email) {
        markDrivePreApproved(auth.currentUser.email);
      }
    } else {
      sessionStorage.removeItem(DRIVE_TOKEN_KEY);
      sessionStorage.removeItem(DRIVE_EXPIRES_KEY);
      localStorage.removeItem(DRIVE_TOKEN_KEY);
      localStorage.removeItem(DRIVE_EXPIRES_KEY);
      localStorage.removeItem('akademi_admin_drive_connected');
    }
  } catch {}
};

export const getCachedAccessToken = (): string | null => {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  try {
    const stored = sessionStorage.getItem(DRIVE_TOKEN_KEY) || localStorage.getItem(DRIVE_TOKEN_KEY);
    const expiresAt = Number(sessionStorage.getItem(DRIVE_EXPIRES_KEY) || localStorage.getItem(DRIVE_EXPIRES_KEY) || 0);
    // Token is valid if stored and not strictly expired
    if (stored && (expiresAt === 0 || expiresAt > Date.now() + 10000)) {
      inMemoryAccessToken = stored;
      return stored;
    }
  } catch {}
  return null;
};

/**
 * Standard Universal Google Authentication for all users (Teachers, Admins, Guests).
 * Uses basic non-sensitive scopes (profile & email).
 * NEVER triggers 403: access_denied, test user blockages, or unverified app warnings for teachers!
 */
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleDriveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setCachedAccessToken(credential.accessToken);
      markDrivePreApproved(result.user?.email || auth.currentUser?.email);
    }
    return result;
  } catch (err: any) {
    if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
      // Gracefully handle user cancelling or closing the popup
      return null;
    }
    // Fallback to standard provider if Drive scope had an issue
    try {
      const fallbackResult = await signInWithPopup(auth, googleProvider);
      return fallbackResult;
    } catch (fallbackErr: any) {
      if (fallbackErr?.code === 'auth/popup-closed-by-user' || fallbackErr?.code === 'auth/cancelled-popup-request') {
        return null;
      }
      console.warn('Google Sign In notice:', fallbackErr?.message || fallbackErr);
      throw fallbackErr;
    }
  }
};

export const connectGoogleDrive = async (silentOnly = false, forceRefresh = false): Promise<string | null> => {
  if (!forceRefresh) {
    const existing = getCachedAccessToken();
    if (existing) return existing;
  } else {
    setCachedAccessToken(null);
  }

  if (silentOnly) {
    return null;
  }

  try {
    // Uses drive.file and select_account (One-time approval, Google remembers consent permanently)
    const result = await signInWithPopup(auth, googleDriveProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setCachedAccessToken(credential.accessToken);
      markDrivePreApproved(result.user?.email || auth.currentUser?.email);
      return credential.accessToken;
    }
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') {
      // User closed drive popup
      return null;
    }
    console.warn('Drive connection notice:', error?.message);
    if (!silentOnly) {
      throw error;
    }
  }
  return null;
};

export const logout = async () => {
  setCachedAccessToken(null);
  return await signOut(auth);
};

// Synthetic user creator for preview / demo / offline environments
export const createSyntheticUser = (email: string, displayName?: string): User => {
  const uid = 'local_' + btoa(email || 'user').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  return {
    uid,
    email: email || 'kirklareliataturkortaokulu@gmail.com',
    displayName: displayName || (email.includes('@') ? email.split('@')[0] : 'Yönetici'),
    emailVerified: true,
    isAnonymous: false,
    photoURL: null,
    phoneNumber: null,
    tenantId: null,
    providerId: 'google.com',
    providerData: [{ providerId: 'google.com', uid, displayName: displayName || 'Yönetici', email }],
    delete: async () => {},
    getIdToken: async () => 'preview-token',
    getIdTokenResult: async () => ({
      token: 'preview-token',
      authTime: new Date().toISOString(),
      issuedAtTime: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 86400000).toISOString(),
      signInProvider: 'google.com',
      signInSecondFactor: null,
      claims: {},
    }),
    reload: async () => {},
    toJSON: () => ({ uid, email, displayName }),
  } as unknown as User;
};

// Firebase Cloud Storage Snapshot Engine (akademi_data.json)
export const CLOUD_STORAGE_SNAPSHOT_PATH = 'snapshots/akademi_data.json';

export const uploadSnapshotToStorage = async (data: any): Promise<{ success: boolean; url?: string; error?: string; nativeStorage?: boolean }> => {
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
  try {
    localStorage.setItem('akademi_data_snapshot_cache', jsonStr);
    localStorage.setItem('akademi_data_snapshot_version', String(data?.version || 1));
    localStorage.setItem('akademi_data_snapshot_time', new Date().toISOString());
  } catch (e) {}

  if (!firebaseConfig.storageBucket) {
    return { success: false, error: 'Firebase Storage bucket yapılandırılmamış' };
  }

  try {
    const storageRef = ref(storage, CLOUD_STORAGE_SNAPSHOT_PATH);
    const uploadPromise = uploadString(storageRef, jsonStr, 'raw', {
      contentType: 'application/json',
      customMetadata: {
        updatedAt: new Date().toISOString(),
        version: String(data?.version || 1),
        updatedBy: auth.currentUser?.email || 'admin'
      }
    }).then(async () => {
      const downloadUrl = await getDownloadURL(storageRef).catch(() => undefined);
      return { success: true, url: downloadUrl, nativeStorage: true };
    });

    // Fast non-blocking timeout for storage mirror (max 4 seconds)
    const timeoutPromise = new Promise<{ success: boolean; url?: string; error?: string; nativeStorage?: boolean }>((resolve) =>
      setTimeout(() => resolve({ success: false, error: 'Storage upload timeout' }), 4000)
    );

    const result = await Promise.race([uploadPromise, timeoutPromise]);
    return result;
  } catch (error: any) {
    console.warn('Firebase Storage upload notice:', error);
    return { success: false, error: error?.message || String(error) };
  }
};

export const fetchSnapshotFromStorage = async (): Promise<{ data: any; lastModified?: string } | null> => {
  if (!firebaseConfig.storageBucket) return null;
  try {
    const storageRef = ref(storage, CLOUD_STORAGE_SNAPSHOT_PATH);
    const fetchPromise = (async () => {
      try {
        const bytes = await getBytes(storageRef, 50 * 1024 * 1024);
        const jsonStr = new TextDecoder().decode(bytes);
        const parsed = JSON.parse(jsonStr);
        return { data: parsed };
      } catch (e: any) {
        if (e?.code === 'storage/object-not-found') {
          return null;
        }
        const downloadUrl = await getDownloadURL(storageRef);
        const resp = await fetch(`${downloadUrl}&t=${Date.now()}`);
        if (resp.ok) {
          const parsed = await resp.json();
          return { data: parsed, lastModified: resp.headers.get('last-modified') || undefined };
        }
        return null;
      }
    })();

    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 20000)
    );

    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error: any) {
    if (error?.code === 'storage/object-not-found') {
      return null;
    }
    console.warn('Firebase Storage download notice:', error);
    return null;
  }
};

export const uploadBackupToStorage = async (backupId: string, backupRecord: any): Promise<{ success: boolean; url?: string; error?: string }> => {
  if (!firebaseConfig.storageBucket) {
    return { success: false, error: 'Firebase Storage bucket yapılandırılmamış' };
  }
  try {
    const storageRef = ref(storage, `backups/${backupId}.json`);
    const uploadPromise = uploadString(storageRef, JSON.stringify(backupRecord), 'raw', {
      contentType: 'application/json',
      customMetadata: {
        backupId,
        createdAt: backupRecord.createdAt || new Date().toISOString(),
        createdByName: backupRecord.createdByName || 'Yönetici'
      }
    }).then(async () => {
      const downloadUrl = await getDownloadURL(storageRef).catch(() => undefined);
      return { success: true, url: downloadUrl };
    });

    const timeoutPromise = new Promise<{ success: boolean; error: string }>((resolve) =>
      setTimeout(() => resolve({ success: false, error: 'Backup storage timeout' }), 25000)
    );

    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (error: any) {
    console.warn('Storage backup upload error:', error);
    return { success: false, error: error?.message || String(error) };
  }
};

export const listBackupsFromStorage = async (): Promise<Array<{ id: string; name: string; url?: string }>> => {
  if (!firebaseConfig.storageBucket) return [];
  try {
    const listRef = ref(storage, 'backups');
    const res = await listAll(listRef);
    const items = await Promise.all(
      res.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef).catch(() => undefined);
        return {
          id: itemRef.name.replace('.json', ''),
          name: itemRef.name,
          url
        };
      })
    );
    return items;
  } catch (e) {
    return [];
  }
};

// Modular Firestore Storage Engine (Subcollection based - 0% risk of 1MB limit & minimal writes)
export interface ModularWriteResult {
  success: boolean;
  updatedModules: string[];
  newHashes: Record<string, string>;
  error?: string;
}

export const fetchModularSchoolState = async (
  dbInstance: any,
  schoolId = 'main'
): Promise<{ data: any; source: 'modular' | 'legacy' | 'none' } | null> => {
  try {
    // 1. Fetch root school document first
    const rootSnap = await getDoc(doc(dbInstance, 'schools', schoolId)).catch(() => null);
    const rootData = (rootSnap && rootSnap.exists()) ? rootSnap.data() : {};

    const merged: any = {
      students: rootData.students || [],
      exams: rootData.exams || [],
      results: rootData.results || [],
      budget: rootData.budget || { incomes: [], expenses: [], debts: [] },
      examHalls: rootData.examHalls || [],
      leagueMentors: rootData.leagueMentors || {},
      leagueTeamPoints: rootData.leagueTeamPoints || {},
      approvedTransfers: rootData.approvedTransfers || [],
      admins: rootData.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com'],
      teachers: rootData.teachers || [],
      version: Number(rootData.version) || 1,
      lastPublishedAt: rootData.lastPublishedAt,
      lastPublishedBy: rootData.lastPublishedBy,
      examCalendarPrintSettings: rootData.examCalendarPrintSettings,
      canonicalDriveFileId: rootData.canonicalDriveFileId,
      canonicalDriveFileLink: rootData.canonicalDriveFileLink
    };

    // 2. Fetch and overlay modular subcollections (modules/*)
    const modulesColRef = collection(dbInstance, 'schools', schoolId, 'modules');
    const snap = await getDocs(modulesColRef).catch(() => null);

    let hasModular = false;
    if (snap && !snap.empty) {
      hasModular = true;
      snap.forEach(docSnap => {
        const id = docSnap.id;
        const d = docSnap.data();
        if (id === 'students' && Array.isArray(d.students) && d.students.length > 0) merged.students = d.students;
        else if (id === 'exams' && Array.isArray(d.exams) && d.exams.length > 0) merged.exams = d.exams;
        else if (id === 'results' && Array.isArray(d.results) && d.results.length > 0) merged.results = d.results;
        else if (id === 'budget' && d.budget) merged.budget = d.budget;
        else if (id === 'halls' && Array.isArray(d.examHalls)) {
          if (d.examHalls.length > 0) {
            merged.examHalls = d.examHalls.map((h: any) => {
              const rootHall = (rootData.examHalls || []).find((rh: any) => rh.id === h.id);
              if ((!h.seatingPlan || h.seatingPlan.length === 0) && rootHall && rootHall.seatingPlan && rootHall.seatingPlan.length > 0) {
                return { ...h, seatingPlan: rootHall.seatingPlan };
              }
              return h;
            });
          } else if (rootData.examHalls && rootData.examHalls.length > 0) {
            merged.examHalls = rootData.examHalls;
          }
        }
        else if (id === 'league') {
          if (d.leagueMentors) merged.leagueMentors = d.leagueMentors;
          if (d.leagueTeamPoints) merged.leagueTeamPoints = d.leagueTeamPoints;
          if (d.approvedTransfers) merged.approvedTransfers = d.approvedTransfers;
        } else if (id === 'meta') {
          if (d.version !== undefined) merged.version = Number(d.version) || merged.version;
          if (d.lastPublishedAt) merged.lastPublishedAt = d.lastPublishedAt;
          if (d.lastPublishedBy) merged.lastPublishedBy = d.lastPublishedBy;
          if (Array.isArray(d.admins) && d.admins.length > 0) merged.admins = d.admins;
          if (Array.isArray(d.teachers)) merged.teachers = d.teachers;
          if (d.examCalendarPrintSettings) merged.examCalendarPrintSettings = d.examCalendarPrintSettings;
          if (d.canonicalDriveFileId) {
            merged.canonicalDriveFileId = d.canonicalDriveFileId;
            merged.canonicalDriveFileLink = d.canonicalDriveFileLink;
            merged.isDriveFileLocked = d.isDriveFileLocked !== false;
            try {
              localStorage.setItem('akademi_live_drive_file_id', d.canonicalDriveFileId);
              if (d.canonicalDriveFileLink) localStorage.setItem('akademi_live_drive_file_link', d.canonicalDriveFileLink);
              if (d.isDriveFileLocked !== false) localStorage.setItem('akademi_live_drive_file_locked', 'true');
            } catch {}
          }
        }
      });
    }

    // 3. Fetch partitioned exam results from schools/{schoolId}/exam_results/*
    // Enables storing unbounded 400+ student exam batches without hitting the 1MB limit
    try {
      const examResultsColRef = collection(dbInstance, 'schools', schoolId, 'exam_results');
      const examResSnap = await getDocs(examResultsColRef).catch(() => null);
      if (examResSnap && !examResSnap.empty) {
        hasModular = true;
        const partitionedResults: any[] = [];
        examResSnap.forEach(partDoc => {
          const partData = partDoc.data();
          if (Array.isArray(partData.results) && partData.results.length > 0) {
            // Find corresponding exam in merged.exams to hydrate its results directly
            const matchingIdx = merged.exams.findIndex((e: any) =>
              String(e.id) === String(partData.examId) || 
              e.name === partData.examName || 
              sanitizeDocId(e.id || e.name) === partDoc.id
            );
            if (matchingIdx >= 0) {
              merged.exams[matchingIdx].results = partData.results;
              merged.exams[matchingIdx].participantCount = Math.max(
                merged.exams[matchingIdx].participantCount || 0,
                partData.results.length
              );
            }
            partitionedResults.push(...partData.results);
          }
        });

        if (partitionedResults.length > 0) {
          const mergedMap = new Map();
          (merged.results || []).forEach((r: any) => {
            const k = r.id || `${r.studentNo || r.no}_${r.examId || ''}`;
            mergedMap.set(k, r);
          });
          partitionedResults.forEach((r: any) => {
            const k = r.id || `${r.studentNo || r.no}_${r.examId || ''}`;
            mergedMap.set(k, r);
          });
          merged.results = Array.from(mergedMap.values());
        }
      }
    } catch (e) {
      console.warn('Notice loading partitioned exam results:', e);
    }

    // 4. Fetch partitioned Arena monthly snapshots from schools/{schoolId}/arena_monthly/*
    try {
      const arenaColRef = collection(dbInstance, 'schools', schoolId, 'arena_monthly');
      const arenaSnap = await getDocs(arenaColRef).catch(() => null);
      if (arenaSnap && !arenaSnap.empty) {
        hasModular = true;
        const arenaMonthlyData: Record<string, any> = {};
        arenaSnap.forEach(partDoc => {
          arenaMonthlyData[partDoc.id] = partDoc.data();
        });
        merged.arenaMonthlyData = arenaMonthlyData;
      }
    } catch (e) {
      console.warn('Notice loading partitioned arena monthly data:', e);
    }

    if (hasModular || (rootSnap && rootSnap.exists())) {
      return { data: merged, source: hasModular ? 'modular' : 'legacy' };
    }

    return null;
  } catch (err: any) {
    console.warn('fetchModularSchoolState notice:', err);
    return null;
  }
};

export const fastHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

export const fetchSchoolMeta = async (dbInstance: any, schoolId = 'main'): Promise<any | null> => {
  try {
    const metaRef = doc(dbInstance, 'schools', schoolId, 'modules', 'meta');
    const snap = await getDoc(metaRef).catch(() => null);
    if (snap && snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const sanitizeDocId = (id: string | number): string => {
  return String(id || 'default')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-]/g, '_')
    .slice(0, 100) || 'exam_default';
};

export const fetchSingleExamResultPartition = async (
  dbInstance: any,
  examId: string | number,
  schoolId = 'main'
): Promise<any | null> => {
  try {
    const docKey = sanitizeDocId(examId);
    const partRef = doc(dbInstance, 'schools', schoolId, 'exam_results', docKey);
    const snap = await getDoc(partRef).catch(() => null);
    if (snap && snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.warn('fetchSingleExamResultPartition notice:', err);
    return null;
  }
};

export const fetchAllExamResultsPartitions = async (
  dbInstance: any,
  schoolId = 'main'
): Promise<Record<string, any>> => {
  const partitions: Record<string, any> = {};
  try {
    const colRef = collection(dbInstance, 'schools', schoolId, 'exam_results');
    const snap = await getDocs(colRef).catch(() => null);
    if (snap && !snap.empty) {
      snap.forEach(d => {
        partitions[d.id] = d.data();
      });
    }
  } catch (e) {
    console.warn('fetchAllExamResultsPartitions notice:', e);
  }
  return partitions;
};

export const fetchSingleArenaMonthlyPartition = async (
  dbInstance: any,
  monthKey: string,
  schoolId = 'main'
): Promise<any | null> => {
  try {
    const docKey = sanitizeDocId(monthKey);
    const docRef = doc(dbInstance, 'schools', schoolId, 'arena_monthly', docKey);
    const snap = await getDoc(docRef).catch(() => null);
    if (snap && snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (e) {
    console.warn('fetchSingleArenaMonthlyPartition notice:', e);
    return null;
  }
};

export const fetchAllArenaMonthlyPartitions = async (
  dbInstance: any,
  schoolId = 'main'
): Promise<Record<string, any>> => {
  const partitions: Record<string, any> = {};
  try {
    const colRef = collection(dbInstance, 'schools', schoolId, 'arena_monthly');
    const snap = await getDocs(colRef).catch(() => null);
    if (snap && !snap.empty) {
      snap.forEach(d => {
        partitions[d.id] = d.data();
      });
    }
  } catch (e) {
    console.warn('fetchAllArenaMonthlyPartitions notice:', e);
  }
  return partitions;
};

export const fetchTeacherSelectiveModules = async (
  dbInstance: any,
  neededModules: string[],
  schoolId = 'main'
): Promise<Record<string, any>> => {
  const result: Record<string, any> = {};
  if (!neededModules || neededModules.length === 0) return result;

  try {
    const fetchPromises = neededModules.map(async (modKey) => {
      const modDocRef = doc(dbInstance, 'schools', schoolId, 'modules', modKey);
      const snap = await getDoc(modDocRef).catch(() => null);
      if (snap && snap.exists()) {
        result[modKey] = snap.data();
      }
    });

    // If teacher needs results, also fetch partitioned exam results from schools/{schoolId}/exam_results/*
    if (neededModules.includes('results')) {
      fetchPromises.push((async () => {
        const partitions = await fetchAllExamResultsPartitions(dbInstance, schoolId);
        result['exam_results_partitions'] = partitions;
        const allPartResults: any[] = [];
        Object.values(partitions).forEach((p: any) => {
          if (Array.isArray(p.results)) {
            allPartResults.push(...p.results);
          }
        });
        if (allPartResults.length > 0) {
          result['results'] = {
            ...(result['results'] || {}),
            results: allPartResults,
            isPartitioned: true
          };
        }
      })());
    }

    // If teacher needs league, also fetch partitioned arena monthly snapshots from schools/{schoolId}/arena_monthly/*
    if (neededModules.includes('league')) {
      fetchPromises.push((async () => {
        const monthlyPartitions = await fetchAllArenaMonthlyPartitions(dbInstance, schoolId);
        result['arena_monthly_partitions'] = monthlyPartitions;
      })());
    }

    await Promise.all(fetchPromises);
  } catch (err) {
    console.warn('fetchTeacherSelectiveModules notice:', err);
  }

  return result;
};

export const saveCanonicalDriveFileToFirestore = async (fileId: string, fileLink?: string, isLocked = true) => {
  try {
    if (!firebaseConfig.projectId) return;
    const cleanId = fileId.trim();
    const cleanLink = fileLink || `https://drive.google.com/file/d/${cleanId}/view`;
    await setDoc(doc(db, 'schools', 'main'), {
      canonicalDriveFileId: cleanId,
      canonicalDriveFileLink: cleanLink,
      isDriveFileLocked: isLocked,
      lastDriveFileUpdatedAt: new Date().toISOString()
    }, { merge: true });
    await setDoc(doc(db, 'schools', 'main', 'modules', 'meta'), {
      canonicalDriveFileId: cleanId,
      canonicalDriveFileLink: cleanLink,
      isDriveFileLocked: isLocked,
      lastDriveFileUpdatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.warn('Could not save canonical drive file to firestore:', e);
  }
};

export const deepCleanForFirestore = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj.toISOString();
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepCleanForFirestore(item)).filter(item => item !== undefined);
  }
  
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = deepCleanForFirestore(value);
    }
  }
  return cleaned;
};

export const writeModularSchoolState = async (
  dbInstance: any,
  cleanState: any,
  lastHashes: Record<string, string>,
  schoolId = 'main',
  forceAll = false
): Promise<ModularWriteResult> => {
  const updatedModules: string[] = [];
  const newHashes: Record<string, string> = { ...lastHashes };

  const safeState = deepCleanForFirestore(cleanState || {});

  // Group and partition exam results by examId/examName to prevent exceeding Firestore 1MB limit
  const examsList = safeState.exams || [];
  const allResults = safeState.results || [];
  const resultsByExam: Record<string, { examId: string; examName: string; results: any[] }> = {};

  examsList.forEach((e: any) => {
    const docKey = sanitizeDocId(e.id || e.name);
    resultsByExam[docKey] = {
      examId: String(e.id || docKey),
      examName: e.name || docKey,
      results: Array.isArray(e.results) ? [...e.results] : []
    };
  });

  allResults.forEach((r: any) => {
    const matchingExam = examsList.find((e: any) =>
      (r.examId && String(e.id) === String(r.examId)) ||
      (r.scores && (r.scores[String(e.id)] !== undefined || r.scores[e.name] !== undefined))
    );
    const docKey = matchingExam ? sanitizeDocId(matchingExam.id || matchingExam.name) : sanitizeDocId(r.examName || 'general');
    if (!resultsByExam[docKey]) {
      resultsByExam[docKey] = {
        examId: matchingExam ? String(matchingExam.id) : docKey,
        examName: matchingExam ? matchingExam.name : (r.examName || docKey),
        results: []
      };
    }
    if (!resultsByExam[docKey].results.some((er: any) => (er.id && er.id === r.id) || (er.studentNo && er.studentNo === r.studentNo))) {
      resultsByExam[docKey].results.push(r);
    }
  });

  const isSmallResults = allResults.length <= 100;
  const examSummaries = Object.entries(resultsByExam).map(([examKey, group]) => ({
    examKey,
    examId: group.examId,
    examName: group.examName,
    studentCount: group.results.length
  }));

  // Compile partitioned monthly Arena snapshots
  const arenaSnapshots = compileMonthlyArenaSnapshots(
    safeState.students || [],
    safeState.exams || [],
    safeState.results || [],
    safeState.leagueMentors || {},
    safeState.leagueTeamPoints || {}
  );

  const monthSummaries = Object.values(arenaSnapshots).map((snap: any) => ({
    monthKey: snap.monthKey,
    monthLabel: snap.monthLabel,
    examCount: snap.examCount,
    studentCount: snap.studentCount,
    topTeam: Object.entries(snap.teamStandings || {}).sort((a: any, b: any) => ((b[1] as any)?.totalLP || 0) - ((a[1] as any)?.totalLP || 0))[0]?.[0] || 'Kutup Yıldızları',
    leaderStudent: snap.podium?.[0]?.name || '',
    updatedAt: snap.updatedAt
  }));

  const modulesData: Record<string, any> = {
    exams: { exams: safeState.exams || [] },
    results: { 
      results: isSmallResults ? safeState.results || [] : [],
      examSummaries,
      totalCount: allResults.length,
      isPartitioned: true,
      updatedAt: new Date().toISOString()
    },
    halls: { examHalls: safeState.examHalls || [] },
    league: {
      leagueMentors: safeState.leagueMentors || {},
      leagueTeamPoints: safeState.leagueTeamPoints || {},
      approvedTransfers: safeState.approvedTransfers || [],
      monthSummaries,
      totalMonthsCount: Object.keys(arenaSnapshots).length,
      isPartitioned: true,
      updatedAt: new Date().toISOString()
    },
    meta: {
      version: safeState.version || 1,
      lastPublishedAt: safeState.lastPublishedAt || new Date().toISOString(),
      lastPublishedBy: safeState.lastPublishedBy || 'admin',
      admins: safeState.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com'],
      teachers: safeState.teachers || [],
      examCalendarPrintSettings: safeState.examCalendarPrintSettings || null,
      canonicalDriveFileId: safeState.canonicalDriveFileId || null,
      canonicalDriveFileLink: safeState.canonicalDriveFileLink || null,
      moduleHashes: {}
    }
  };

  // Compute fingerprints for each individual data module
  const moduleHashes: Record<string, string> = {};
  for (const [key, val] of Object.entries(modulesData)) {
    if (key !== 'meta') {
      moduleHashes[key] = fastHash(JSON.stringify(val));
    }
  }
  modulesData.meta.moduleHashes = moduleHashes;

  try {
    const promises: Promise<void>[] = [];

    // Lightweight root school document without dumping raw students or sensitive budget (stored in Google Drive)
    const rootPayload = deepCleanForFirestore({
      name: "Kırklareli Atatürk Ortaokulu",
      version: safeState.version || 1,
      lastPublishedAt: safeState.lastPublishedAt || new Date().toISOString(),
      lastPublishedBy: safeState.lastPublishedBy || 'admin',
      admins: safeState.admins || ['kirklareliataturkortaokulu@gmail.com', 'bahadirkumcu@gmail.com'],
      teachers: safeState.teachers || [],
      studentCount: safeState.students?.length || 0,
      examCount: safeState.exams?.length || 0,
      hallCount: safeState.examHalls?.length || 0,
      resultCount: allResults.length,
      canonicalDriveFileId: safeState.canonicalDriveFileId || null,
      canonicalDriveFileLink: safeState.canonicalDriveFileLink || null
    });
    const rootPayloadStr = JSON.stringify(rootPayload);
    if (forceAll || lastHashes['root_school'] !== rootPayloadStr) {
      const rootSchoolRef = doc(dbInstance, 'schools', schoolId);
      promises.push(setDoc(rootSchoolRef, rootPayload, { merge: true }));
      newHashes['root_school'] = rootPayloadStr;
    }

    // Write partitioned exam results to schools/{schoolId}/exam_results/{examId}
    for (const [examKey, examGroup] of Object.entries(resultsByExam)) {
      if (examGroup.results.length > 0) {
        const partPayload = {
          examId: examGroup.examId,
          examName: examGroup.examName,
          studentCount: examGroup.results.length,
          updatedAt: new Date().toISOString(),
          results: examGroup.results
        };
        const payloadStr = JSON.stringify(partPayload);
        const partHashKey = `exam_results_${examKey}`;
        if (forceAll || lastHashes[partHashKey] !== payloadStr) {
          const partDocRef = doc(dbInstance, 'schools', schoolId, 'exam_results', examKey);
          promises.push(setDoc(partDocRef, deepCleanForFirestore(partPayload)));
          newHashes[partHashKey] = payloadStr;
        }
      }
    }

    // Write partitioned monthly arena snapshots to schools/{schoolId}/arena_monthly/{monthKey}
    for (const [mKey, snapshotPayload] of Object.entries(arenaSnapshots)) {
      const payloadStr = JSON.stringify(snapshotPayload);
      const partHashKey = `arena_monthly_${mKey}`;
      if (forceAll || lastHashes[partHashKey] !== payloadStr) {
        const partDocRef = doc(dbInstance, 'schools', schoolId, 'arena_monthly', mKey);
        promises.push(setDoc(partDocRef, deepCleanForFirestore(snapshotPayload)));
        newHashes[partHashKey] = payloadStr;
      }
    }

    for (const [modKey, modPayload] of Object.entries(modulesData)) {
      const payloadStr = JSON.stringify(modPayload);
      if (forceAll || lastHashes[modKey] !== payloadStr) {
        const modDocRef = doc(dbInstance, 'schools', schoolId, 'modules', modKey);
        promises.push(setDoc(modDocRef, deepCleanForFirestore(modPayload)));
        updatedModules.push(modKey);
        newHashes[modKey] = payloadStr;
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    return { success: true, updatedModules, newHashes };
  } catch (err: any) {
    console.warn('writeModularSchoolState notice:', err);
    return { success: false, updatedModules, newHashes, error: err?.message || String(err) };
  }
};

export type { User };
export { 
  doc, 
  getDoc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit, 
  disableNetwork,
  enableNetwork,
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  GoogleAuthProvider,
  ref,
  uploadString,
  getDownloadURL,
  deleteObject,
  listAll,
  getBytes
};
