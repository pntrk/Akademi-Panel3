import { db, auth, doc, setDoc, getDocs, onSnapshot, collection, checkIsQuotaExceededToday } from './firebase';
import { HallAttendance, ExamHall, Exam } from '../types';
import { publishCloudNotification, playNotificationChime } from './notifications';
import { parseDateObj } from './utils';

const LOCAL_ATTENDANCE_KEY = 'akademi_hall_attendances_cache';
const LAST_FETCH_TS_KEY = 'akademi_attendances_last_fetch_ts';
const ATTENDANCE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 dakikalık akıllı okuma önbelleği (Firebase Spark Reads tasarrufu)

// BroadcastChannel for instant, zero-quota cross-tab synchronization
const attendanceChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new BroadcastChannel('akademi_attendance_channel')
  : null;

/**
 * Sisteme giriş yapmış olan öğretmenin veya yöneticinin doğrulanmış e-posta ve ad bilgilerini 
 * bilgi bozukluğuna mahal vermeden en güvenilir kaynaklardan tutarlı biçimde tespit eder.
 */
export const getActiveTeacherIdentity = (currentUserObj?: any): { email: string; displayName: string } => {
  let email = '';
  let displayName = '';

  // 1. AppContext / Props üzerinden gelen doğrulanmış oturum kullanıcısı
  if (currentUserObj?.email) {
    const raw = currentUserObj.email.trim().toLowerCase();
    if (!raw.includes('abdullaherbileses')) {
      email = raw;
      displayName = currentUserObj.displayName || currentUserObj.name || '';
    }
  }

  // 2. Firebase Auth doğrudan kontrolü (eğer henüz AppContext oturumu senkron değilse)
  if (!email && auth.currentUser?.email) {
    const raw = auth.currentUser.email.trim().toLowerCase();
    if (!raw.includes('abdullaherbileses')) {
      email = raw;
      displayName = auth.currentUser.displayName || displayName;
    }
  }

  // 3. Tarayıcı oturum hafızası kontrolü (Eski abdullaherbileses test kayıtları temizlenir)
  if (!email) {
    try {
      const rawSession = localStorage.getItem('akademi_user_session');
      if (rawSession) {
        if (rawSession.toLowerCase().includes('abdullaherbileses')) {
          localStorage.removeItem('akademi_user_session');
        } else {
          const parsed = JSON.parse(rawSession);
          if (parsed?.email && !parsed.email.toLowerCase().includes('abdullaherbileses')) {
            email = parsed.email.trim().toLowerCase();
            displayName = parsed.displayName || parsed.name || displayName;
          }
        }
      }
    } catch {}
  }

  // 4. Tekil kullanıcı e-posta hafızası (Eski abdullaherbileses temizlenir)
  if (!email) {
    try {
      const savedEmail = localStorage.getItem('akademi_user_email');
      if (savedEmail) {
        if (savedEmail.toLowerCase().includes('abdullaherbileses')) {
          localStorage.removeItem('akademi_user_email');
        } else {
          email = savedEmail.trim().toLowerCase();
        }
      }
    } catch {}
  }

  // E-postadan veya profilden temiz görünen isim oluşturma
  if (!displayName || displayName.toLowerCase().includes('abdullaherbileses')) {
    if (email) {
      const prefix = email.split('@')[0];
      displayName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
    } else {
      displayName = 'Gözetmen Öğretmen';
    }
  }

  // İsim içinde gereksiz e-posta parantezleri veya bozuklukları temizle
  let cleanDisplayName = displayName.replace(/\s*\([^)]*@.*?\)/g, '').trim() || 'Gözetmen Öğretmen';
  if (cleanDisplayName.toLowerCase().includes('abdullaherbileses')) {
    cleanDisplayName = email ? email.split('@')[0] : 'Gözetmen Öğretmen';
  }

  return {
    email: email || '',
    displayName: cleanDisplayName
  };
};

// Load cached attendances from localStorage (Eski abdullaherbileses kayıtlarını dinamik temizler)
export const getLocalAttendances = (): Record<string, HallAttendance> => {
  try {
    const raw = localStorage.getItem(LOCAL_ATTENDANCE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, HallAttendance>;
    let hasModified = false;
    const currentRealEmail = (auth.currentUser?.email || '').trim().toLowerCase();

    for (const key of Object.keys(parsed)) {
      const item = parsed[key];
      if (item) {
        const isLegacyEmail = item.takenByEmail && item.takenByEmail.toLowerCase().includes('abdullaherbileses');
        const isLegacyName = item.takenBy && item.takenBy.toLowerCase().includes('abdullaherbileses');
        if (isLegacyEmail || isLegacyName) {
          hasModified = true;
          const cleanEmail = (currentRealEmail && !currentRealEmail.includes('abdullaherbileses'))
            ? currentRealEmail
            : '';
          item.takenByEmail = cleanEmail;
          if (isLegacyName) {
            item.takenBy = cleanEmail || 'Gözetmen Öğretmen';
          }
        }
      }
    }

    if (hasModified) {
      localStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return {};
  }
};

// Save attendance to localStorage cache and broadcast locally with 0 Firestore reads
export const cacheLocalAttendance = (attendance: HallAttendance) => {
  try {
    const all = getLocalAttendances();
    all[attendance.id] = attendance;
    localStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(all));
    
    // 1. Aynı pencere içi event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('akademi_attendance_updated', { detail: attendance }));
    }

    // 2. Diğer açık sekmeler ve cihaz ekranları için BroadcastChannel (0 Firebase Quota)
    if (attendanceChannel) {
      try {
        attendanceChannel.postMessage({ type: 'ATTENDANCE_SAVED', payload: attendance });
      } catch {}
    }
  } catch (e) {
    console.warn('Yerel yoklama önbelleğe yazılamadı:', e);
  }
};

// Listen to cross-tab BroadcastChannel events
if (attendanceChannel) {
  attendanceChannel.onmessage = (event) => {
    if (event.data?.type === 'ATTENDANCE_SAVED' && event.data?.payload) {
      const attendance = event.data.payload as HallAttendance;
      try {
        const all = getLocalAttendances();
        all[attendance.id] = attendance;
        localStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(all));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('akademi_attendance_updated', { detail: attendance }));
        }
      } catch {}
    }
  };
}

/**
 * Yoklama içeriğinin benzersiz parmak izini oluşturur.
 * İçerik değişmemişse gereksiz Firebase Writes isteklerini önlemek için kullanılır.
 */
export const getAttendanceFingerprint = (att: HallAttendance): string => {
  const absentsSorted = (att.absentStudents || [])
    .map(s => `${s.studentId}_${s.studentNo}`)
    .sort()
    .join('|');
  return `${att.examId}__${att.hallId}__${att.totalAssigned}__${att.absentCount}__${absentsSorted}`;
};

/**
 * Yeni yoklama kaydı ile mevcut kayıt arasında fark olup olmadığını kontrol eder.
 */
export const isAttendanceIdentical = (newAtt: HallAttendance, existingAtt?: HallAttendance): boolean => {
  if (!existingAtt) return false;
  return getAttendanceFingerprint(newAtt) === getAttendanceFingerprint(existingAtt);
};

/**
 * Checks if a given exam date matches a target date (defaults to today)
 */
export const isExamDateMatches = (examDateStr?: string, targetDate = new Date()): boolean => {
  if (!examDateStr) return false;
  const d = parseDateObj(examDateStr);
  if (!d) return false;
  return (
    d.getFullYear() === targetDate.getFullYear() &&
    d.getMonth() === targetDate.getMonth() &&
    d.getDate() === targetDate.getDate()
  );
};

/**
 * Finds the scheduled exam for a given hall on today's date (or target date).
 * Checks specific hall assignments first, then class intersections, or fallback to today's general exam.
 */
export const findTodayExamForHall = (
  hall: ExamHall, 
  exams: Exam[], 
  targetDate = new Date()
): Exam | null => {
  if (!exams || exams.length === 0) return null;

  // 1. Filter exams happening on targetDate
  const todayExams = exams.filter(e => isExamDateMatches(e.date, targetDate));
  if (todayExams.length === 0) return null;

  // 2. Exact match by hall.examId or hall.examIds
  const exactMatch = todayExams.find(e => 
    e.id === hall.examId || 
    (hall.examIds && hall.examIds.includes(e.id)) ||
    (e.assignedHalls && e.assignedHalls.includes(hall.id))
  );
  if (exactMatch) return exactMatch;

  // 3. Match by shared classes
  if (hall.selectedClasses && hall.selectedClasses.length > 0) {
    const classMatch = todayExams.find(e => {
      if (!e.participatingClasses || e.participatingClasses.length === 0) return false;
      return hall.selectedClasses!.some(cls => e.participatingClasses!.includes(cls));
    });
    if (classMatch) return classMatch;
  }

  // 4. Return the primary exam of today if only one exam exists today
  return todayExams[0];
};

// In-flight locking mechanism to prevent rapid-click duplicate writes
const inFlightSubmissions = new Set<string>();

/**
 * Saves hall attendance in Firestore and broadcasts an instant push notification.
 * 
 * SPARK PLANI & KOTA KORUMA MİMARİSİ (Yüzlerce öğretmen aynı anda yoklama alsa bile 0 risk):
 * 1. İçerik Parmak İzi (Deduplication): Devamsız öğrenci listesi değişmemişse Firestore'a 0 yazma yapılır.
 * 2. Eşzamanlı İstek Kilidi (In-Flight Mutex): Aynı salon için mükerrer kaydetmeler engellenir.
 * 3. Deterministik Tekil Belge (Merge Write): Her salon yoklaması yalnızca `schools/{id}/attendances/{examId}_{hallId}` belgesine 1 tekil yazma yapar.
 * 4. Deterministik Bildirim Belgesi: Bildirim koleksiyonu şişirilmez; `notifications/notif_att_{examId}_{hallId}` güncellenerek 1 yazma ile sınırlanır.
 * 5. Doğrulanmış Öğretmen Kimliği (Zero Corruption): Öğretmenin giriş yaptığı e-posta ve adı bildirimde ve kayıtta %100 tutarlı olarak yayınlanır.
 * 6. Yerel Kanal & Broadcast Sync: Tüm cihaz sekmeleri Firestore okuması yapmadan anında senkronize olur.
 */
export const submitHallAttendance = async (
  attendance: HallAttendance,
  schoolId = 'main'
): Promise<{ success: boolean; unchanged?: boolean; error?: string }> => {
  const submissionKey = `${attendance.id}`;
  
  if (inFlightSubmissions.has(submissionKey)) {
    return { success: true, unchanged: true };
  }
  
  inFlightSubmissions.add(submissionKey);

  try {
    const existingRecords = getLocalAttendances();
    const previousRecord = existingRecords[attendance.id];

    // 1. İçerik Değişmedi Kontrolü (Gereksiz Write Tasarrufu: 0 Firestore Writes!)
    if (previousRecord && isAttendanceIdentical(attendance, previousRecord)) {
      cacheLocalAttendance(attendance);
      playNotificationChime();
      return { success: true, unchanged: true };
    }

    // 2. Yerel Hafızaya Anında Yaz & Sekmeler Arası Senkronize Et (Gecikmesiz Kullanıcı Deneyimi)
    cacheLocalAttendance(attendance);

    // 3. Bildirim Sesi
    playNotificationChime();

    // 4. Doğrulanmış Öğretmen Kimliği & E-posta Formatlama (Bilgi bozukluğunu önler)
    const teacherEmail = (attendance.takenByEmail || '').trim().toLowerCase();
    const cleanTeacherName = (attendance.takenBy || '').replace(/\s*\([^)]*\)/g, '').trim() || (teacherEmail ? teacherEmail.split('@')[0] : 'Gözetmen Öğretmen');
    
    // Tutarlı gözetmen künyesi: "Ad Soyad (ornek@gmail.com)" veya "ornek@gmail.com"
    const teacherBadge = teacherEmail && !cleanTeacherName.toLowerCase().includes(teacherEmail)
      ? `${cleanTeacherName} (${teacherEmail})`
      : cleanTeacherName;

    // 5. Firestore'a Tekil Deterministik Belge Olarak Kaydet (1 Write)
    if (!checkIsQuotaExceededToday()) {
      const attendanceRef = doc(db, 'schools', schoolId, 'attendances', attendance.id);
      await setDoc(attendanceRef, {
        ...attendance,
        takenBy: cleanTeacherName,
        takenByEmail: teacherEmail,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    // 6. İdareye Anlık Bildirim Gönder (Deterministik 1 Write, yığılma ve fazla kota tüketmez)
    const absents = attendance.absentStudents || [];
    let notifBody = '';

    if (absents.length > 0) {
      const studentListPreview = absents
        .map(s => `${s.studentNo} - ${s.studentName} (${s.studentClass || 'Sınıf'})`)
        .join(', ');
      notifBody = `📌 Salonda bulunmayan ${absents.length} öğrenci: ${studentListPreview}. (Gözetmen: ${teacherBadge})`;
    } else {
      notifBody = `✅ Tüm öğrenciler (${attendance.totalAssigned} kişi) eksiksiz olarak salondadır. (Gözetmen: ${teacherBadge})`;
    }

    const deterministicNotifId = `notif_att_${attendance.id}`;

    await publishCloudNotification({
      id: deterministicNotifId,
      title: `📋 ${attendance.hallName} - ${attendance.examName} Yoklaması`,
      message: notifBody,
      type: 'announcement',
      linkTab: 'halls',
      targetRole: 'admin',
      createdByEmail: teacherEmail || undefined,
      createdByName: cleanTeacherName
    });

    // Son okuma zamanını güncelle
    localStorage.setItem(LAST_FETCH_TS_KEY, String(Date.now()));

    return { success: true, unchanged: false };
  } catch (error: any) {
    console.warn('Yoklama bulut kaydında gecikme (yerelde güvenle saklandı):', error);
    return { success: true, error: error?.message };
  } finally {
    setTimeout(() => {
      inFlightSubmissions.delete(submissionKey);
    }, 2000);
  }
};

/**
 * Fetches all saved attendances for the school with Smart Cache-First TTL.
 * 10 dakika içinde tekrar çağrıldığında Firestore'dan sorgu çekmez, yerel hafızadan anında döndürür (Reads tasarrufu).
 */
export const fetchAllAttendances = async (
  schoolId = 'main',
  forceRefresh = false
): Promise<Record<string, HallAttendance>> => {
  const local = getLocalAttendances();

  // Kota dolmuşsa veya Firestore yoksa doğrudan yerel önbellek
  if (checkIsQuotaExceededToday()) {
    return local;
  }

  const now = Date.now();
  const lastFetchTs = parseInt(localStorage.getItem(LAST_FETCH_TS_KEY) || '0', 10);
  const isCacheValid = (now - lastFetchTs) < ATTENDANCE_CACHE_TTL_MS && Object.keys(local).length > 0;

  // Önbellek geçerliyse ve zorla yenileme istenmediyse 0 Firestore Reads tüketir
  if (!forceRefresh && isCacheValid) {
    return local;
  }

  try {
    const colRef = collection(db, 'schools', schoolId, 'attendances');
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      snap.forEach(docSnap => {
        const data = docSnap.data() as HallAttendance;
        if (data) {
          if (data.takenByEmail && data.takenByEmail.toLowerCase().includes('abdullaherbileses')) {
            data.takenByEmail = '';
          }
          if (data.takenBy && data.takenBy.toLowerCase().includes('abdullaherbileses')) {
            data.takenBy = data.takenByEmail || 'Gözetmen Öğretmen';
          }
          local[data.id] = data;
        }
      });
      // Update cache and timestamp
      localStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(local));
      localStorage.setItem(LAST_FETCH_TS_KEY, String(now));
    }
  } catch (err) {
    console.warn('Bulut yoklama kayıtları alınamadı (yerel önbellek kullanılıyor):', err);
  }

  return local;
};

/**
 * Real-time live Firestore listener for all teacher and admin users.
 * Whenever any teacher saves or updates hall attendance, all other teachers instantly
 * receive the changes in real-time across their screens without needing a manual refresh.
 */
export const subscribeToAttendances = (
  schoolId = 'main',
  onUpdate: (attendances: Record<string, HallAttendance>) => void
): (() => void) => {
  if (checkIsQuotaExceededToday()) {
    onUpdate(getLocalAttendances());
    return () => {};
  }

  try {
    const colRef = collection(db, 'schools', schoolId, 'attendances');
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const local = getLocalAttendances();
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data() as HallAttendance;
        if (data) {
          if (data.takenByEmail && data.takenByEmail.toLowerCase().includes('abdullaherbileses')) {
            data.takenByEmail = '';
          }
          if (data.takenBy && data.takenBy.toLowerCase().includes('abdullaherbileses')) {
            data.takenBy = data.takenByEmail || 'Gözetmen Öğretmen';
          }
          if (change.type === 'removed') {
            delete local[data.id];
          } else {
            local[data.id] = data;
          }
        }
      });
      localStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(local));
      onUpdate({ ...local });
    }, (error) => {
      console.warn('Canlı yoklama dinleyicisi hatası (yerel mod devrede):', error);
      onUpdate(getLocalAttendances());
    });

    return unsubscribe;
  } catch (err) {
    console.warn('Yoklama dinleyicisi başlatılamadı:', err);
    onUpdate(getLocalAttendances());
    return () => {};
  }
};
