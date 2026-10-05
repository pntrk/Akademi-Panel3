import { db, doc, setDoc, getDocs, collection, checkIsQuotaExceededToday } from './firebase';
import { HallAttendance, ExamHall, Exam } from '../types';
import { publishCloudNotification, playNotificationChime } from './notifications';
import { parseDateObj } from './utils';

const LOCAL_ATTENDANCE_KEY = 'akademi_hall_attendances_cache';
const LAST_FETCH_TS_KEY = 'akademi_attendances_last_fetch_ts';
const ATTENDANCE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 dakikalık akıllı okuma önbelleği (Firebase Reads tasarrufu)

// Load cached attendances from localStorage
export const getLocalAttendances = (): Record<string, HallAttendance> => {
  try {
    const raw = localStorage.getItem(LOCAL_ATTENDANCE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

// Save attendance to localStorage cache
export const cacheLocalAttendance = (attendance: HallAttendance) => {
  try {
    const all = getLocalAttendances();
    all[attendance.id] = attendance;
    localStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(all));
  } catch (e) {
    console.warn('Yerel yoklama önbelleğe yazılamadı:', e);
  }
};

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

/**
 * Saves hall attendance in Firestore and broadcasts an instant push notification.
 * 
 * KOTA OPTİMİZASYONLARI:
 * 1. İçerik Karşılaştırma (Deduplication): Devamsız öğrenci listesi değişmemişse Firestore yazma isteği yapılmaz (0 writes).
 * 2. Deterministik Bildirim ID: Her salon için tekil `notif_att_${id}` kullanılarak bildirim belgesi ezilir, yığılma ve fazla yazma önlenir.
 * 3. Anında Yerel Önbellek: Ağ gecikmesi ve kota beklemeden anında çalışır.
 */
export const submitHallAttendance = async (
  attendance: HallAttendance,
  schoolId = 'main'
): Promise<{ success: boolean; unchanged?: boolean; error?: string }> => {
  const existingRecords = getLocalAttendances();
  const previousRecord = existingRecords[attendance.id];

  // 1. İçerik Değişmedi Kontrolü (Gereksiz Write Tasarrufu)
  if (previousRecord && isAttendanceIdentical(attendance, previousRecord)) {
    // Yerel önbelleği tazele
    cacheLocalAttendance(attendance);
    playNotificationChime();
    return { success: true, unchanged: true };
  }

  // 2. Immediately cache locally
  cacheLocalAttendance(attendance);

  // 3. Play subtle confirmation chime
  playNotificationChime();

  try {
    // 4. Write to Firestore if quota permits (1 single write per hall attendance)
    if (!checkIsQuotaExceededToday()) {
      const attendanceRef = doc(db, 'schools', schoolId, 'attendances', attendance.id);
      await setDoc(attendanceRef, {
        ...attendance,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    // 5. Publish push notification to school admins with verified teacher identity and email
    const absents = attendance.absentStudents || [];
    let notifBody = '';

    const teacherEmail = attendance.takenByEmail?.trim() || '';
    const teacherName = attendance.takenBy?.trim() || 'Gözetmen Öğretmen';
    const teacherDisplay = teacherEmail && !teacherName.includes(teacherEmail)
      ? `${teacherName} (${teacherEmail})`
      : teacherName;

    if (absents.length > 0) {
      const studentListPreview = absents
        .map(s => `${s.studentNo} - ${s.studentName} (${s.studentClass || 'Sınıf'})`)
        .join(', ');
      notifBody = `📌 Salonda bulunmayan ${absents.length} öğrenci: ${studentListPreview}. (Gözetmen: ${teacherDisplay})`;
    } else {
      notifBody = `✅ Tüm öğrenciler (${attendance.totalAssigned} kişi) eksiksiz olarak salondadır. (Gözetmen: ${teacherDisplay})`;
    }

    // Deterministik ID kullanarak mevcut salon bildirimini günceller (Yeni belge üretip kota tüketmez)
    const deterministicNotifId = `notif_att_${attendance.id}`;

    await publishCloudNotification({
      id: deterministicNotifId,
      title: `📋 ${attendance.hallName} - ${attendance.examName} Yoklaması`,
      message: notifBody,
      type: 'announcement',
      linkTab: 'halls',
      createdByEmail: teacherEmail || undefined,
      createdByName: teacherDisplay
    });

    // Son okuma zamanını güncelle ki hemen ardından tekrar getDocs yapmasın
    localStorage.setItem(LAST_FETCH_TS_KEY, String(Date.now()));

    return { success: true, unchanged: false };
  } catch (error: any) {
    console.warn('Yoklama bulut kaydında gecikme (yerelde korundu):', error);
    // Still report success as local state and chime are preserved
    return { success: true, error: error?.message };
  }
};

/**
 * Fetches all saved attendances for the school with Smart Cache-First TTL.
 * 5 dakika içinde tekrar çağrıldığında Firestore'dan sorgu çekmez, yerel hafızadan anında döndürür (Reads tasarrufu).
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
        local[data.id] = data;
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
