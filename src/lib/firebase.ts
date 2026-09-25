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
import rawFirebaseConfig from '../../firebase-applet-config.json';

export const firebaseConfig = rawFirebaseConfig;

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with custom database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);

export const FIRESTORE_UPGRADE_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;

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
  } catch (e) {}
};

export const clearQuotaExceeded = () => {
  try {
    localStorage.removeItem('firestore_quota_exceeded_date');
    localStorage.removeItem('firestore_quota_exceeded_project');
    enableNetwork(db).catch(() => {});
  } catch (e) {}
};

// Immediate check on boot: if quota was already exceeded today, disable network immediately to avoid backoff loops
if (checkIsQuotaExceededToday()) {
  disableNetwork(db).catch(() => {});
}

// Global safety net: detect quota exhaustion from unhandled promises or runtime errors
if (typeof window !== 'undefined') {
  const checkErrorForQuota = (err: any) => {
    const errStr = String(err?.message || err?.reason?.message || err?.reason || err || '');
    if (
      errStr.includes('Quota exceeded') ||
      errStr.includes('resource-exhausted') ||
      err?.code === 'resource-exhausted' ||
      err?.reason?.code === 'resource-exhausted' ||
      errStr.includes('Free daily write units') ||
      errStr.includes('Free daily read units')
    ) {
      markQuotaExceededToday();
    }
  };

  window.addEventListener('unhandledrejection', (event) => {
    checkErrorForQuota(event.reason);
  });

  window.addEventListener('error', (event) => {
    checkErrorForQuota(event.error);
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
    if (errStr.includes('Quota exceeded') || errStr.includes('resource-exhausted') || error?.code === 'resource-exhausted' || errStr.includes('Free daily write units')) {
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
  GoogleAuthProvider 
};
