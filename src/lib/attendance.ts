import { db, doc, setDoc, getDocs, collection, checkIsQuotaExceededToday } from './firebase';
import { HallAttendance, ExamHall, Exam } from '../types';
import { publishCloudNotification, playNotificationChime } from './notifications';
import { parseDateObj } from './utils';

const LOCAL_ATTENDANCE_KEY = 'akademi_hall_attendances_cache';

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
 * Saves hall attendance in Firestore (1 write per hall) and broadcasts an instant push notification
 * to school admins (1 write per hall).
 */
export const submitHallAttendance = async (
  attendance: HallAttendance,
  schoolId = 'main'
): Promise<{ success: boolean; error?: string }> => {
  // 1. Immediately cache locally
  cacheLocalAttendance(attendance);

  // 2. Play subtle confirmation chime
  playNotificationChime();

  try {
    // 3. Write to Firestore if quota permits (1 single batch write)
    if (!checkIsQuotaExceededToday()) {
      const attendanceRef = doc(db, 'schools', schoolId, 'attendances', attendance.id);
      await setDoc(attendanceRef, {
        ...attendance,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    // 4. Publish push notification to school admins
    const absents = attendance.absentStudents || [];
    let notifBody = '';

    if (absents.length > 0) {
      const studentListPreview = absents
        .map(s => `${s.studentNo} - ${s.studentName} (${s.studentClass || 'Sınıf'})`)
        .join(', ');
      notifBody = `📌 Salonda bulunmayan ${absents.length} öğrenci: ${studentListPreview}. (Gözetmen: ${attendance.takenBy})`;
    } else {
      notifBody = `✅ Tüm öğrenciler (${attendance.totalAssigned} kişi) eksiksiz olarak salondadır. (Gözetmen: ${attendance.takenBy})`;
    }

    await publishCloudNotification({
      title: `📋 ${attendance.hallName} - ${attendance.examName} Yoklaması`,
      message: notifBody,
      type: 'announcement',
      linkTab: 'halls'
    });

    return { success: true };
  } catch (error: any) {
    console.warn('Yoklama bulut kaydında gecikme (yerelde korundu):', error);
    // Still report success as local state and chime are preserved
    return { success: true, error: error?.message };
  }
};

/**
 * Fetches all saved attendances for the school
 */
export const fetchAllAttendances = async (
  schoolId = 'main'
): Promise<Record<string, HallAttendance>> => {
  const local = getLocalAttendances();

  if (checkIsQuotaExceededToday()) {
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
      // Update cache
      localStorage.setItem(LOCAL_ATTENDANCE_KEY, JSON.stringify(local));
    }
  } catch (err) {
    console.warn('Bulut yoklama kayıtları alınamadı (yerel önbellek kullanılıyor):', err);
  }

  return local;
};
