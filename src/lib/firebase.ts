/**
 * Yerel Bağımsız Veritabanı ve Kimlik Doğrulama Katmanı
 * (Firebase bağımlılıkları kaldırılmış, LocalStorage destekli yerel çalışma modu)
 * 
 * İleride yeni bir Firebase projesi açıldığında tekrar kolayca bağlanabilir.
 */

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  emailVerified?: boolean;
  isAnonymous?: boolean;
  phoneNumber?: string | null;
  tenantId?: string | null;
  providerId?: string;
  providerData?: any[];
  delete?: () => Promise<void>;
  getIdToken?: () => Promise<string>;
  getIdTokenResult?: () => Promise<any>;
  reload?: () => Promise<void>;
  toJSON?: () => any;
}

// Boşaltılmış yapılandırma (İleride yeni Firebase projesi oluşturulunca buraya eklenecektir)
export const firebaseConfig = {
  projectId: "",
  appId: "",
  apiKey: "",
  authDomain: "",
  firestoreDatabaseId: "(default)",
  storageBucket: "",
  messagingSenderId: ""
};

const LOCAL_USER_KEY = 'akademi_current_user';

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
    providerId: 'local',
    providerData: [{ providerId: 'local', uid, displayName: displayName || 'Yönetici', email }],
    delete: async () => {},
    getIdToken: async () => 'local-preview-token',
    getIdTokenResult: async () => ({
      token: 'local-preview-token',
      authTime: new Date().toISOString(),
      issuedAtTime: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 86400000).toISOString(),
      signInProvider: 'local',
      signInSecondFactor: null,
      claims: {},
    }),
    reload: async () => {},
    toJSON: () => ({ uid, email, displayName }),
  };
};

// Başlangıçta doğrudan yönetici oturumu ile açılsın
const getStoredUser = (): User => {
  try {
    const saved = localStorage.getItem(LOCAL_USER_KEY) || sessionStorage.getItem('akademi_preview_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.email) {
        return createSyntheticUser(parsed.email, parsed.displayName);
      }
    }
  } catch (e) {}
  return createSyntheticUser('kirklareliataturkortaokulu@gmail.com', 'Kırklareli Atatürk Ortaokulu (Yönetici)');
};

let currentAuthUser: User | null = getStoredUser();
const authSubscribers = new Set<(user: User | null) => void>();

const notifyAuthSubscribers = () => {
  authSubscribers.forEach(cb => {
    try {
      cb(currentAuthUser);
    } catch (e) {
      console.warn('Auth subscriber error:', e);
    }
  });
};

export const auth = {
  get currentUser() {
    return currentAuthUser;
  },
  set currentUser(user: User | null) {
    currentAuthUser = user;
    if (user) {
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify({ email: user.email, displayName: user.displayName }));
    } else {
      localStorage.removeItem(LOCAL_USER_KEY);
      try {
        sessionStorage.removeItem('akademi_preview_user');
      } catch (e) {}
    }
    notifyAuthSubscribers();
  }
};

export const onAuthStateChanged = (_authInstance: any, callback: (user: User | null) => void) => {
  authSubscribers.add(callback);
  // Async initial notification
  setTimeout(() => callback(currentAuthUser), 0);
  return () => {
    authSubscribers.delete(callback);
  };
};

export const loginWithGoogle = async (email?: string, displayName?: string) => {
  const chosenEmail = email || 'kirklareliataturkortaokulu@gmail.com';
  const chosenName = displayName || 'Kırklareli Atatürk Ortaokulu (Yönetici)';
  const user = createSyntheticUser(chosenEmail, chosenName);
  auth.currentUser = user;
  return { user };
};

export const logout = async () => {
  auth.currentUser = null;
};

export const signOut = logout;
export const signInWithPopup = loginWithGoogle;
export const signInWithRedirect = loginWithGoogle;
export const getRedirectResult = async () => null;

export class GoogleAuthProvider {
  setCustomParameters(_params: any) {}
}

export const db = {
  type: 'local-store',
  projectId: ''
};

export const app = { name: '[DEFAULT]' };
export const setLogLevel = (_level: string) => {};
export const getDocFromServer = async (_ref: any) => null;
export const initializeApp = (_config?: any) => app;
export const getApps = () => [app];
export const getApp = () => app;
export const getAuth = (_appInstance?: any) => auth;
export const getFirestore = (_appInstance?: any, _dbId?: string) => db;

// Firestore Document & Collection Referansları
export interface LocalDocRef {
  type: 'doc';
  path: string;
  id: string;
}

export interface LocalCollectionRef {
  type: 'collection';
  path: string;
}

export const doc = (_dbOrCol: any, ...pathSegments: string[]): LocalDocRef => {
  const cleanSegments = pathSegments.filter(Boolean);
  const path = cleanSegments.join('/');
  const id = cleanSegments[cleanSegments.length - 1] || 'doc';
  return { type: 'doc', path, id };
};

export const collection = (_dbInstance: any, ...pathSegments: string[]): LocalCollectionRef => {
  const cleanSegments = pathSegments.filter(Boolean);
  return { type: 'collection', path: cleanSegments.join('/') };
};

export const query = (colRef: any, ..._constraints: any[]) => colRef;
export const orderBy = (_field: string, _dir?: 'asc' | 'desc') => ({});
export const limit = (_num: number) => ({});

// Local Event Bus
const localListeners = new Map<string, Set<(snap: any) => void>>();

export const onSnapshot = (
  ref: LocalDocRef | LocalCollectionRef,
  onNext: (snap: any) => void,
  _onError?: (err: any) => void
) => {
  const path = ref.path;
  if (!localListeners.has(path)) {
    localListeners.set(path, new Set());
  }
  const listeners = localListeners.get(path)!;
  listeners.add(onNext);

  // Initial trigger
  setTimeout(async () => {
    try {
      if (ref.type === 'doc') {
        const snap = await getDoc(ref);
        onNext(snap);
      } else {
        const snap = await getDocs(ref);
        onNext(snap);
      }
    } catch (e) {
      console.warn('Local onSnapshot error:', e);
    }
  }, 10);

  return () => {
    listeners.delete(onNext);
  };
};

const notifyPathChanged = (path: string) => {
  const docListeners = localListeners.get(path);
  if (docListeners && docListeners.size > 0) {
    const snap = getDocSync(path);
    docListeners.forEach(cb => {
      try { cb(snap); } catch (e) {}
    });
  }

  const segments = path.split('/');
  if (segments.length > 1) {
    const colPath = segments.slice(0, -1).join('/');
    const colListeners = localListeners.get(colPath);
    if (colListeners && colListeners.size > 0) {
      const snap = getDocsSync(colPath);
      colListeners.forEach(cb => {
        try { cb(snap); } catch (e) {}
      });
    }
  }
};

const getStorageKey = (path: string) => `akademi_local_db_${path.replace(/\//g, '_')}`;

const getDocSync = (path: string) => {
  const key = getStorageKey(path);
  let raw = localStorage.getItem(key);
  if (!raw && (path === 'schools/main' || path === 'schools')) {
    raw = localStorage.getItem('okulYonetimState');
  }

  const id = path.split('/').pop() || 'doc';
  if (!raw) {
    return {
      id,
      exists: () => false,
      data: () => null
    };
  }

  try {
    const data = JSON.parse(raw);
    return {
      id,
      exists: () => true,
      data: () => data
    };
  } catch {
    return {
      id,
      exists: () => false,
      data: () => null
    };
  }
};

export const getDoc = async (docRef: LocalDocRef) => {
  return getDocSync(docRef.path);
};

const getDocsSync = (colPath: string) => {
  const prefix = getStorageKey(colPath) + '_';
  const docs: any[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        const docId = key.replace(prefix, '');
        docs.push({
          id: docId,
          data: () => data,
          exists: () => true
        });
      } catch (e) {}
    }
  }

  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: (cb: (doc: any) => void) => docs.forEach(cb),
    docChanges: () => []
  };
};

export const getDocs = async (colRef: LocalCollectionRef) => {
  return getDocsSync(colRef.path);
};

export const setDoc = async (docRef: LocalDocRef, data: any, _options?: any) => {
  const key = getStorageKey(docRef.path);
  localStorage.setItem(key, JSON.stringify(data));
  if (docRef.path === 'schools/main') {
    localStorage.setItem('okulYonetimState', JSON.stringify(data));
  }
  notifyPathChanged(docRef.path);
  return;
};

export const deleteDoc = async (docRef: LocalDocRef) => {
  const key = getStorageKey(docRef.path);
  localStorage.removeItem(key);
  notifyPathChanged(docRef.path);
  return;
};
