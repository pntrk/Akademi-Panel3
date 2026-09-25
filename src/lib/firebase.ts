import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  type User 
} from 'firebase/auth';
import { 
  getFirestore, 
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
import rawFirebaseConfig from '../../firebase-applet-config.json';

export const firebaseConfig = rawFirebaseConfig;

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with custom database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Storage
export const storage: FirebaseStorage = getStorage(app);
try {
  // Prevent SDK from retrying for 10 minutes when bucket is unreachable/uncreated
  storage.maxUploadRetryTime = 2500;
  storage.maxOperationRetryTime = 2500;
} catch (e) {}

// Initialize Firebase Auth
export const auth = getAuth(app);

export const FIRESTORE_UPGRADE_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
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

// Google Auth Provider setup
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const loginWithGoogle = async () => {
  return await signInWithPopup(auth, googleProvider);
};

export const logout = async () => {
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

    const timeoutPromise = new Promise<{ success: boolean; url?: string; error?: string; nativeStorage?: boolean }>((resolve) =>
      setTimeout(() => resolve({ success: false, error: 'Storage upload timeout' }), 2500)
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
      setTimeout(() => resolve(null), 2500)
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
      setTimeout(() => resolve({ success: false, error: 'Backup storage timeout' }), 2500)
    );

    return await Promise.race([uploadPromise, timeoutPromise]);
  } catch (error: any) {
    console.warn('Storage backup upload error:', error);
    return { success: false, error: error?.message || String(error) };
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
