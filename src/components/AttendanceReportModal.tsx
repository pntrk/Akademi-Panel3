import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useAppContext } from '../context/AppContext';
import { Exam, ExamHall, Student, HallAttendance, AbsentStudentInfo } from '../types';
import { formatDateLong, normalizeForSearch, parseDateObj } from '../lib/utils';
import { 
  X, FileSpreadsheet, Printer, Search, Users, UserCheck, 
  UserX, Building, CheckCircle2, Clock, AlertTriangle, 
  Calendar, ChevronRight, School, Sparkles, Filter, RefreshCw
} from 'lucide-react';

interface AttendanceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  exams: Exam[];
  examHalls: ExamHall[];
  students: Student[];
  attendances: Record<string, HallAttendance>;
  initialExamId?: string;
  onRefreshAttendances?: () => Promise<void>;
  userRole?: string;
}

export const AttendanceReportModal: React.FC<AttendanceReportModalProps> = ({
  isOpen,
  onClose,
  exams,
  examHalls,
  students: _allStudents,
  attendances,
  initialExamId,
  onRefreshAttendances,
  userRole
}) => {
  const { userRole: ctxUserRole } = useAppContext();
  const effectiveRole = userRole || ctxUserRole || 'guest';
  const isTeacher = effectiveRole !== 'admin';

  // Sınavları tarih bazlı doğru ve deterministik biçimde sınıflandır:
  // 1. Bugünün aktif sınavları (todayExams)
  // 2. Gelecek sınavlar (upcomingExams) - Henüz vakti gelmedi
  // 3. Geçmiş sınavlar (pastExams) - Tarihi geçenler [Geçmiş]
  const { todayExams, upcomingExams, pastExams } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTs = today.getTime();

    const todayList: { exam: Exam; timestamp: number }[] = [];
    const upcomingList: { exam: Exam; timestamp: number }[] = [];
    const pastList: { exam: Exam; timestamp: number }[] = [];

    exams.forEach(exam => {
      const d = parseDateObj(exam.date);
      if (!d || isNaN(d.getTime())) {
        upcomingList.push({ exam, timestamp: Infinity });
        return;
      }
      const examDay = new Date(d);
      examDay.setHours(0, 0, 0, 0);
      const examTs = examDay.getTime();

      if (examTs === todayTs) {
        todayList.push({ exam, timestamp: examTs });
      } else if (examTs < todayTs) {
        pastList.push({ exam, timestamp: examTs });
      } else {
        upcomingList.push({ exam, timestamp: examTs });
      }
    });

    // Sıralama:
    // Bugün: isme göre
    todayList.sort((a, b) => a.exam.name.localeCompare(b.exam.name, 'tr-TR'));
    // Gelecek / Yaklaşan: en yakından en uzağa
    upcomingList.sort((a, b) => a.timestamp - b.timestamp);
    // Geçmiş: en yeni geçmişten eskiye (arşiv sıralaması)
    pastList.sort((a, b) => b.timestamp - a.timestamp);

    return {
      todayExams: todayList.map(item => item.exam),
      upcomingExams: upcomingList.map(item => item.exam),
      pastExams: pastList.map(item => item.exam)
    };
  }, [exams]);

  // 1. Sınav seçimi (Öğretmenler sadece günün sınavını seçebilir; idareciler günün sınavı, initialExamId veya arşivden seçebilir)
  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    if (isTeacher) {
      if (initialExamId && todayExams.some(e => e.id === initialExamId)) {
        return initialExamId;
      }
      return todayExams[0]?.id || '';
    }

    if (initialExamId && exams.some(e => e.id === initialExamId)) {
      return initialExamId;
    }
    if (todayExams.length > 0) return todayExams[0].id;
    return upcomingExams[0]?.id || pastExams[0]?.id || exams[0]?.id || '';
  });

  // initialExamId prop veya todayExams listesi değiştiğinde senkronize et
  React.useEffect(() => {
    if (isTeacher) {
      if (initialExamId && todayExams.some(e => e.id === initialExamId)) {
        setSelectedExamId(initialExamId);
      } else if (todayExams.length > 0 && !todayExams.some(e => e.id === selectedExamId)) {
        setSelectedExamId(todayExams[0].id);
      } else if (todayExams.length === 0) {
        setSelectedExamId('');
      }
    } else {
      if (initialExamId && exams.some(e => e.id === initialExamId)) {
        setSelectedExamId(initialExamId);
      }
    }
  }, [initialExamId, exams, isTeacher, todayExams]);

  // 2. Sekme: 'halls' (Salona göre) | 'classes' (Sınıfa göre devamsızlar / e-Okul)
  const [activeTab, setActiveTab] = useState<'halls' | 'classes'>('halls');

  // 3. Arama filtresi
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Seçili sınav nesnesi
  const selectedExam = useMemo(() => {
    if (isTeacher) {
      return todayExams.find(e => e.id === selectedExamId) || todayExams[0] || null;
    }
    return exams.find(e => e.id === selectedExamId) || todayExams[0] || upcomingExams[0] || pastExams[0] || null;
  }, [exams, selectedExamId, isTeacher, todayExams, upcomingExams, pastExams]);

  // Seçili sınava bağlı salonlar
  const relevantHalls = useMemo(() => {
    if (!selectedExam) return examHalls;

    const matched = examHalls.filter(hall => {
      // 1. Hall.examId veya hall.examIds eşleşmesi
      if (hall.examId === selectedExam.id) return true;
      if (hall.examIds && hall.examIds.includes(selectedExam.id)) return true;
      
      // 2. Exam.assignedHalls eşleşmesi
      if (selectedExam.assignedHalls && selectedExam.assignedHalls.includes(hall.id)) return true;

      // 3. Bu salona ait seçili sınav için gönderilmiş bir yoklama var mı?
      const attKey = `${selectedExam.id}_${hall.id}`;
      if (attendances[attKey]) return true;

      // 4. Şube kesişimi
      if (hall.selectedClasses && hall.selectedClasses.length > 0 && selectedExam.participatingClasses && selectedExam.participatingClasses.length > 0) {
        return hall.selectedClasses.some(c => selectedExam.participatingClasses!.includes(c));
      }

      return false;
    });

    // Eğer filtreleme sonucunda hiç salon bulunamazsa ve genel salonlar varsa oturma düzeni olanları göster
    if (matched.length === 0) {
      return examHalls.filter(h => (h.seatingPlan?.length || 0) > 0);
    }

    return matched;
  }, [selectedExam, examHalls, attendances]);

  // Salon bazlı birleştirilmiş yoklama kayıtları
  const consolidatedHallReports = useMemo(() => {
    if (!selectedExam) return [];

    return relevantHalls.map(hall => {
      const attKey = `${selectedExam.id}_${hall.id}`;
      // Key ile veya hallId ve examId ile ara
      const attendance = attendances[attKey] || 
        (Object.values(attendances) as HallAttendance[]).find(a => a.examId === selectedExam.id && a.hallId === hall.id);

      const seatingCount = hall.seatingPlan?.length || 0;
      const isSubmitted = attendance && attendance.status === 'submitted';

      const totalAssigned = attendance?.totalAssigned ?? seatingCount;
      const presentCount = isSubmitted ? (attendance.presentCount ?? (totalAssigned - (attendance.absentCount || 0))) : totalAssigned;
      const absentCount = isSubmitted ? (attendance.absentCount ?? (attendance.absentStudents?.length || 0)) : 0;
      const absentStudents: AbsentStudentInfo[] = attendance?.absentStudents || [];

      // Gözetmen kimliği
      const supervisorName = attendance?.takenBy || 'Gözetmen Atanmadı';
      const supervisorEmail = attendance?.takenByEmail || '';
      const submittedAt = attendance?.takenAt || '';

      return {
        hallId: hall.id,
        hallName: hall.name,
        capacity: hall.capacity || seatingCount,
        totalAssigned,
        presentCount,
        absentCount,
        absentStudents,
        isSubmitted: Boolean(isSubmitted),
        supervisorName,
        supervisorEmail,
        submittedAt,
        notes: attendance?.notes || ''
      };
    });
  }, [selectedExam, relevantHalls, attendances]);

  // Genel İstatistikler
  const summaryStats = useMemo(() => {
    let totalAssigned = 0;
    let totalPresent = 0;
    let totalAbsent = 0;
    let submittedHalls = 0;

    consolidatedHallReports.forEach(r => {
      totalAssigned += r.totalAssigned;
      if (r.isSubmitted) {
        totalPresent += r.presentCount;
        totalAbsent += r.absentCount;
        submittedHalls++;
      } else {
        // Teslim edilmemiş salonlarda henüz net yoklama bilinmiyor
        totalPresent += r.totalAssigned;
      }
    });

    const totalHalls = consolidatedHallReports.length;
    const attendanceRate = totalAssigned > 0 ? ((totalPresent / totalAssigned) * 100).toFixed(1) : '100.0';
    const absentRate = totalAssigned > 0 ? ((totalAbsent / totalAssigned) * 100).toFixed(1) : '0.0';

    return {
      totalAssigned,
      totalPresent,
      totalAbsent,
      totalHalls,
      submittedHalls,
      attendanceRate,
      absentRate,
      allSubmitted: totalHalls > 0 && submittedHalls === totalHalls
    };
  }, [consolidatedHallReports]);

  // Sınıf / Şubeye Göre Gruplanmış Devamsızlar Listesi
  const classGroupedAbsentees = useMemo(() => {
    interface AbsenteeEntry {
      studentNo: number;
      studentName: string;
      studentClass: string;
      hallName: string;
      deskNumber: number;
      supervisorName: string;
    }

    const map: Record<string, AbsenteeEntry[]> = {};

    consolidatedHallReports.forEach(hallReport => {
      if (hallReport.isSubmitted && hallReport.absentStudents) {
        hallReport.absentStudents.forEach(st => {
          const cls = (st.studentClass || 'Belirtilmemiş').trim();
          if (!map[cls]) {
            map[cls] = [];
          }
          map[cls].push({
            studentNo: st.studentNo,
            studentName: st.studentName,
            studentClass: cls,
            hallName: hallReport.hallName,
            deskNumber: st.deskNumber,
            supervisorName: hallReport.supervisorName
          });
        });
      }
    });

    // Sınıfları doğal olarak sırala (örn: 8-A, 8-B, 8-C...)
    const sortedClasses = Object.keys(map).sort((a, b) => {
      return a.localeCompare(b, 'tr-TR', { numeric: true });
    });

    return sortedClasses.map(className => ({
      className,
      students: map[className].sort((a, b) => a.studentNo - b.studentNo)
    }));
  }, [consolidatedHallReports]);

  // Canlı arama filtresi uygulama
  const filteredHallReports = useMemo(() => {
    if (!searchQuery.trim()) return consolidatedHallReports;
    const q = normalizeForSearch(searchQuery);

    return consolidatedHallReports.map(hr => {
      const hallMatch = normalizeForSearch(hr.hallName).includes(q) || 
                         normalizeForSearch(hr.supervisorName).includes(q);
      
      const matchedAbsents = hr.absentStudents.filter(s => 
        normalizeForSearch(s.studentName).includes(q) ||
        String(s.studentNo).includes(q) ||
        normalizeForSearch(s.studentClass).includes(q)
      );

      if (hallMatch) return hr;
      if (matchedAbsents.length > 0) {
        return {
          ...hr,
          absentStudents: matchedAbsents
        };
      }
      return null;
    }).filter(Boolean) as typeof consolidatedHallReports;
  }, [consolidatedHallReports, searchQuery]);

  const filteredClassGroupedAbsentees = useMemo(() => {
    if (!searchQuery.trim()) return classGroupedAbsentees;
    const q = normalizeForSearch(searchQuery);

    return classGroupedAbsentees.map(cg => {
      const classMatch = normalizeForSearch(cg.className).includes(q);
      const matchedStudents = cg.students.filter(s => 
        normalizeForSearch(s.studentName).includes(q) ||
        String(s.studentNo).includes(q) ||
        normalizeForSearch(s.hallName).includes(q)
      );

      if (classMatch) return cg;
      if (matchedStudents.length > 0) {
        return {
          className: cg.className,
          students: matchedStudents
        };
      }
      return null;
    }).filter(Boolean) as typeof classGroupedAbsentees;
  }, [classGroupedAbsentees, searchQuery]);

  // Excel (.xlsx) İndirme Fonksiyonu (2 Zengin Sayfalı)
  const handleExportExcel = () => {
    if (!selectedExam) return;

    const examTitle = selectedExam.name || 'Sinav';
    const examDate = selectedExam.date || new Date().toLocaleDateString('tr-TR');

    // Sayfa 1: Salon Bazlı Yoklama Özeti
    const hallRows: any[] = [];
    consolidatedHallReports.forEach((hr, index) => {
      const absentListStr = hr.absentStudents.length > 0
        ? hr.absentStudents.map(s => `${s.studentNo} ${s.studentName} (${s.studentClass})`).join(', ')
        : 'Yok (Tüm öğrenciler katıldı)';

      hallRows.push({
        'SIRA': index + 1,
        'SALON ADI': hr.hallName,
        'GÖZETMEN ÖĞRETMEN': hr.supervisorName,
        'GÖZETMEN E-POSTA': hr.supervisorEmail || '-',
        'TESLİM DURUMU': hr.isSubmitted ? 'Teslim Edildi' : 'Bekleniyor',
        'TESLİM SAATİ': hr.submittedAt ? new Date(hr.submittedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-',
        'YERLEŞEN ÖĞRENCİ': hr.totalAssigned,
        'KATILAN (MEVCUT)': hr.presentCount,
        'DEVAMSIZ (GELMEYEN)': hr.absentCount,
        'GELMEYEN ÖĞRENCİLER LİSTESİ': absentListStr
      });
    });

    // Sayfa 2: Sınıf / Şube Devamsızlık Çizelgesi (e-Okul Girişi İçin)
    const classRows: any[] = [];
    let absIndex = 1;
    classGroupedAbsentees.forEach(cg => {
      cg.students.forEach(st => {
        classRows.push({
          'SIRA': absIndex++,
          'SINIF / ŞUBE': st.studentClass,
          'ÖĞRENCİ NO': st.studentNo,
          'ADI SOYADI': st.studentName,
          'SINAV SALONU': st.hallName,
          'SIRA NO': st.deskNumber,
          'GÖZETMEN': st.supervisorName
        });
      });
    });

    // Excel Kitapçığı Oluştur
    const wb = XLSX.utils.book_new();

    const wsHalls = XLSX.utils.json_to_sheet(hallRows);
    XLSX.utils.book_append_sheet(wb, wsHalls, "Salon_Yoklamalari");

    if (classRows.length > 0) {
      const wsClasses = XLSX.utils.json_to_sheet(classRows);
      XLSX.utils.book_append_sheet(wb, wsClasses, "Sinif_Devamsizlik_Listesi");
    } else {
      const wsEmpty = XLSX.utils.json_to_sheet([{ 'BİLGİ': 'Bu sınavda devamsız öğrenci bulunmamaktadır. Tüm öğrenciler eksiksiz katılmıştır.' }]);
      XLSX.utils.book_append_sheet(wb, wsEmpty, "Devamsiz_Yok");
    }

    const cleanExamName = examTitle.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, '_');
    XLSX.writeFile(wb, `Sinav_Yoklama_Raporu_${cleanExamName}_${examDate}.xlsx`);
  };

  // Resmi Yazdırma (A4 MEB Tutanak Formatı)
  const handlePrintReport = () => {
    if (!selectedExam) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Yazdırma penceresi açılamadı. Lütfen tarayıcınızın açılır pencere (popup) engelleyicisini kaldırın.');
      return;
    }

    const examTitle = selectedExam.name || 'Sınav';
    const examDate = selectedExam.date ? formatDateLong(selectedExam.date) : new Date().toLocaleDateString('tr-TR');
    const nowTime = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="tr">
        <head>
          <meta charset="utf-8">
          <title>${examTitle} - Sınav Yoklama ve Devamsızlık Tutanağı</title>
          <style>
            @page { size: A4 portrait; margin: 10mm 12mm; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; 
              color: #111; 
              margin: 0; 
              padding: 0;
              font-size: 11px;
              line-height: 1.35;
            }
            .header-banner {
              text-align: center;
              border-bottom: 2px solid #222;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .header-banner h1 {
              font-size: 14px;
              margin: 0 0 2px 0;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .header-banner h2 {
              font-size: 13px;
              margin: 0 0 4px 0;
              font-weight: 700;
            }
            .header-banner h3 {
              font-size: 12px;
              margin: 0;
              font-weight: 800;
              text-transform: uppercase;
              color: #b91c1c;
            }
            .meta-box {
              display: flex;
              justify-content: space-between;
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 6px 10px;
              margin-bottom: 12px;
              font-size: 10.5px;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 14px;
            }
            .stat-cell {
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 6px;
              text-align: center;
              background: #fff;
            }
            .stat-cell .label {
              font-size: 9.5px;
              text-transform: uppercase;
              color: #475569;
              font-weight: 700;
            }
            .stat-cell .value {
              font-size: 14px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 2px;
            }
            .section-title {
              font-size: 11.5px;
              font-weight: 800;
              text-transform: uppercase;
              color: #1e293b;
              margin: 12px 0 6px 0;
              border-bottom: 1.5px solid #64748b;
              padding-bottom: 3px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 12px;
              font-size: 10px;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 4px 6px;
              text-align: left;
            }
            th {
              background-color: #f1f5f9;
              font-weight: 800;
              color: #1e293b;
              text-transform: uppercase;
              font-size: 9.5px;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .badge-present { color: #047857; font-weight: 700; }
            .badge-absent { color: #b91c1c; font-weight: 700; }
            .badge-pending { color: #d97706; font-weight: 700; }
            .footer-sign-box {
              margin-top: 24px;
              page-break-inside: avoid;
              border-top: 1px dashed #94a3b8;
              padding-top: 12px;
            }
            .sign-columns {
              display: flex;
              justify-content: space-around;
              text-align: center;
              margin-top: 16px;
            }
            .sign-col {
              width: 30%;
            }
            .sign-col .role { font-weight: 700; font-size: 10.5px; }
            .sign-col .space { height: 40px; }
            .sign-col .name { font-size: 10px; color: #475569; }
          </style>
        </head>
        <body>
          <div class="header-banner">
            <h1>T.C. MİLLİ EĞİTİM BAKANLIĞI</h1>
            <h2>KIRKLARELİ ATATÜRK ORTAOKULU MÜDÜRLÜĞÜ</h2>
            <h3>${examTitle} BİRLEŞTİRİLMİŞ SINAV YOKLAMA VE DEVAMSIZLIK TUTANAĞI</h3>
          </div>

          <div class="meta-box">
            <div><strong>Sınav Tarihi:</strong> ${examDate}</div>
            <div><strong>Rapor Saati:</strong> ${nowTime}</div>
            <div><strong>Kapsanan Salon Sayısı:</strong> ${summaryStats.totalHalls} Salon</div>
            <div><strong>Genel Katılım Oranı:</strong> %${summaryStats.attendanceRate}</div>
          </div>

          <div class="stats-grid">
            <div class="stat-cell">
              <div class="label">Kayıtlı / Yerleşen</div>
              <div class="value">${summaryStats.totalAssigned} Öğrenci</div>
            </div>
            <div class="stat-cell">
              <div class="label">Sınava Katılan</div>
              <div class="value" style="color:#047857;">${summaryStats.totalPresent} Öğrenci</div>
            </div>
            <div class="stat-cell">
              <div class="label">Devamsız (Gelmeyen)</div>
              <div class="value" style="color:#b91c1c;">${summaryStats.totalAbsent} Öğrenci</div>
            </div>
            <div class="stat-cell">
              <div class="label">Salon Teslim Durumu</div>
              <div class="value">${summaryStats.submittedHalls} / ${summaryStats.totalHalls} Tamamlandı</div>
            </div>
          </div>

          <div class="section-title">1. SALON BAZLI YOKLAMA TESLİM ÇİZELGESİ</div>
          <table>
            <thead>
              <tr>
                <th style="width: 25px;" class="text-center">No</th>
                <th>Salon Adı</th>
                <th>Gözetmen Öğretmen</th>
                <th class="text-center" style="width: 70px;">Durum</th>
                <th class="text-center" style="width: 55px;">Yerleşen</th>
                <th class="text-center" style="width: 55px;">Katılan</th>
                <th class="text-center" style="width: 55px;">Gelmeyen</th>
                <th style="width: 100px;" class="text-center">İmza</th>
              </tr>
            </thead>
            <tbody>
              ${consolidatedHallReports.map((hr, idx) => `
                <tr>
                  <td class="text-center">${idx + 1}</td>
                  <td><strong>${hr.hallName}</strong></td>
                  <td>${hr.supervisorName}</td>
                  <td class="text-center ${hr.isSubmitted ? 'badge-present' : 'badge-pending'}">
                    ${hr.isSubmitted ? 'Teslim Edildi' : 'Bekleniyor'}
                  </td>
                  <td class="text-center font-mono">${hr.totalAssigned}</td>
                  <td class="text-center font-mono badge-present">${hr.presentCount}</td>
                  <td class="text-center font-mono ${hr.absentCount > 0 ? 'badge-absent' : ''}">${hr.absentCount}</td>
                  <td></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="section-title">2. ŞUBE BAZLI DEVAMSIZ ÖĞRENCİLER LİSTESİ (e-OKUL GİRİŞİ İÇİN)</div>
          ${classGroupedAbsentees.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th style="width: 30px;" class="text-center">Sıra</th>
                  <th style="width: 70px;">Sınıf / Şube</th>
                  <th style="width: 70px;" class="text-center">Öğrenci No</th>
                  <th>Öğrenci Adı Soyadı</th>
                  <th>Sınav Salonu</th>
                  <th style="width: 50px;" class="text-center">Sıra No</th>
                  <th>Gözetmen</th>
                </tr>
              </thead>
              <tbody>
                ${(() => {
                  let rowNum = 1;
                  return classGroupedAbsentees.map(cg => 
                    cg.students.map(st => `
                      <tr>
                        <td class="text-center">${rowNum++}</td>
                        <td><strong>${st.studentClass}</strong></td>
                        <td class="text-center font-mono"><strong>${st.studentNo}</strong></td>
                        <td>${st.studentName}</td>
                        <td>${st.hallName}</td>
                        <td class="text-center font-mono">${st.deskNumber}</td>
                        <td>${st.supervisorName}</td>
                      </tr>
                    `).join('')
                  ).join('');
                })()}
              </tbody>
            </table>
          ` : `
            <div style="background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; padding:8px 12px; border-radius:4px; margin-bottom:12px; font-weight:700;">
              ✓ Bu sınavda salona yerleşen tüm öğrenciler sınava katılmış olup hiçbir şubede devamsız öğrenci bulunmamaktadır.
            </div>
          `}

          <div class="footer-sign-box">
            <div style="font-size: 10px; color:#475569; text-align: justify; margin-bottom: 8px;">
              Yukarıda dökümü yapılan ${examTitle} sınavına ait salon yoklama tutanakları dijital sistem üzerinden eksiksiz incelenmiş, devamsız öğrencilerin listesi doğrulanmış ve e-Okul / sınav kayıt sistemine işlenmek üzere imza altına alınmıştır.
            </div>
            <div class="sign-columns">
              <div class="sign-col">
                <div class="role">Sınav Koordinatörü</div>
                <div class="space"></div>
                <div class="name">İmza / Tarih</div>
              </div>
              <div class="sign-col">
                <div class="role">Müdür Yardımcısı</div>
                <div class="space"></div>
                <div class="name">İmza / Tarih</div>
              </div>
              <div class="sign-col">
                <div class="role">Okul Müdürü</div>
                <div class="space"></div>
                <div class="name">Mühür / İmza</div>
              </div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in font-sans">
      <div 
        className="bg-white dark:bg-[#15171C] w-full max-w-5xl h-[100dvh] sm:h-auto sm:max-h-[92vh] rounded-t-2xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <header className="px-3.5 py-3 sm:px-5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 bg-slate-50/90 dark:bg-[#1A1D24]">
          {/* Üst Satır: Başlık, Durum Rozeti ve Mobil Kapat Butonu */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800 flex items-center justify-center shrink-0 shadow-2xs">
                <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <h2 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white font-serif tracking-tight truncate">
                    Yoklama Raporu
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 shrink-0 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Canlı</span>
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
                  Tüm salonlardan anlık tutanaklar & e-Okul devamsızlık listesi
                </p>
              </div>
            </div>

            {/* Mobil Kapat Butonu */}
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0 touch-manipulation"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Aksiyon Butonları & Masaüstü Kapat */}
          <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2 shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-slate-200/60 dark:border-slate-800/80">
            <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              {onRefreshAttendances && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsRefreshing(true);
                    try {
                      await onRefreshAttendances();
                    } finally {
                      setIsRefreshing(false);
                    }
                  }}
                  disabled={isRefreshing}
                  className="p-2 sm:px-2.5 sm:py-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                  title="Yoklamaları Yeniden Sorgula"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              )}

              <button
                type="button"
                onClick={handleExportExcel}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer touch-manipulation"
                title="Excel (.xlsx) olarak indir"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span>Excel İndir</span>
              </button>

              <button
                type="button"
                onClick={handlePrintReport}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer border border-slate-700/50 touch-manipulation"
                title="Resmi A4 MEB sınav tutanağı formatında yazdır / PDF kaydet"
              >
                <Printer className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Yazdır / PDF</span>
              </button>
            </div>

            {/* Masaüstü Kapat Butonu */}
            <button
              type="button"
              onClick={onClose}
              className="hidden md:flex p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer ml-1"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* SINAV SEÇİMİ & KONTROL ÇUBUĞU */}
        <div className="px-3.5 py-2.5 sm:px-5 sm:py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#15171C] flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3">
          {/* Sınav Açılır Kutusu / Arşiv Seçimi */}
          <div className="flex items-center gap-2 flex-1 w-full max-w-full md:max-w-lg">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap flex items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="hidden xs:inline">Sınav / Arşiv:</span>
              <span className="xs:hidden">Sınav:</span>
            </span>
            <div className="relative flex-1 min-w-0">
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full bg-slate-100/90 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 py-2 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 cursor-pointer truncate"
                title="Raporlanacak sınavı seçin"
              >
                {/* 1. ÖĞRETMEN GÖRÜNÜMÜ: Yalnızca bugünün aktif sınavı, geçmiş sınavlar gizlidir */}
                {isTeacher ? (
                  todayExams.length > 0 ? (
                    <optgroup label="📅 Bugünün Aktif Sınavları [Canlı Yoklama]" className="font-bold text-emerald-700 dark:text-emerald-400">
                      {todayExams.map(exam => {
                        const examAtts = (Object.values(attendances) as HallAttendance[]).filter(a => a.examId === exam.id && a.status === 'submitted');
                        const submittedCount = examAtts.length;
                        return (
                          <option key={exam.id} value={exam.id}>
                            {exam.name} {exam.date ? `(${exam.date})` : ''} • [Bugün] {submittedCount > 0 ? `• [${submittedCount} Salon Teslim Edildi]` : '• [Yoklama Bekleniyor]'}
                          </option>
                        );
                      })}
                    </optgroup>
                  ) : (
                    <option value="">
                      📅 Bugün için aktif bir sınav bulunmuyor
                    </option>
                  )
                ) : (
                  /* 2. İDARECİ GÖRÜNÜMÜ: Tüm sınavlar tarih sırasına göre net ibarelerle gösterilir */
                  <>
                    {/* A. Bugünün Aktif Sınavları */}
                    {todayExams.length > 0 && (
                      <optgroup label="📅 Bugünün Sınavları [Aktif Canlı Yoklama]" className="font-bold text-emerald-700 dark:text-emerald-400">
                        {todayExams.map(exam => {
                          const examAtts = (Object.values(attendances) as HallAttendance[]).filter(a => a.examId === exam.id && a.status === 'submitted');
                          const submittedCount = examAtts.length;
                          return (
                            <option key={exam.id} value={exam.id}>
                              {exam.name} {exam.date ? `(${exam.date})` : ''} • [Bugün] {submittedCount > 0 ? `• [${submittedCount} Salon Teslim Edildi]` : '• [Yoklama Bekleniyor]'}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}

                    {/* B. Gelecek / Yaklaşan Sınavlar (Tarihi Henüz Gelmemiş Olanlar) */}
                    {upcomingExams.length > 0 && (
                      <optgroup label="⏳ Gelecek Sınavlar [Henüz Vakti Gelmedi]" className="font-bold text-indigo-700 dark:text-indigo-400">
                        {upcomingExams.map(exam => {
                          return (
                            <option key={exam.id} value={exam.id}>
                              {exam.name} {exam.date ? `(${exam.date})` : ''} • [Henüz Vakti Gelmedi]
                            </option>
                          );
                        })}
                      </optgroup>
                    )}

                    {/* C. Tarihi Geçmiş Sınavlar Arşivi */}
                    {pastExams.length > 0 && (
                      <optgroup label="🗄️ Geçmiş Sınavlar Arşivi [Geçmiş]" className="font-bold text-slate-600 dark:text-slate-400">
                        {pastExams.map(exam => {
                          const examAtts = (Object.values(attendances) as HallAttendance[]).filter(a => a.examId === exam.id && a.status === 'submitted');
                          const submittedCount = examAtts.length;
                          return (
                            <option key={exam.id} value={exam.id}>
                              {exam.name} {exam.date ? `(${exam.date})` : ''} • [Geçmiş] {submittedCount > 0 ? `• [${submittedCount} Salon Arşiv Kaydı]` : ''}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </>
                )}
              </select>
            </div>

            {/* Seçili sınavın teslim özeti rozeti */}
            {selectedExam && (
              <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 shrink-0">
                <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>{summaryStats.submittedHalls}/{summaryStats.totalHalls}</span>
                <span className="hidden sm:inline">Salon</span>
              </span>
            )}
          </div>

          {/* Sekme Değiştirici (Salona Göre / Sınıfa Göre) */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-full md:w-auto shrink-0 gap-1 border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setActiveTab('halls')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'halls'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>🏢</span>
              <span className="sm:hidden">Salonlar ({consolidatedHallReports.length})</span>
              <span className="hidden sm:inline">Salona Göre Dağılım ({consolidatedHallReports.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('classes')}
              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'classes'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <span>🎓</span>
              <span className="sm:hidden">Devamsızlar ({summaryStats.totalAbsent})</span>
              <span className="hidden sm:inline">Sınıfa Göre Devamsızlar ({summaryStats.totalAbsent})</span>
            </button>
          </div>
        </div>

        {/* 4 ÖZET METRİK GÖSTERGESİ (Tabular Numerals, High-Density KPI) */}
        <div className="px-3 py-2.5 sm:px-5 sm:py-3.5 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
          {/* Metrik 1: Toplam Yerleşen */}
          <div className="p-2.5 sm:p-3 bg-white dark:bg-[#1E222B] rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                Toplam Yerleşen
              </div>
              <div className="text-base sm:text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
                {summaryStats.totalAssigned}
              </div>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 ml-1">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          {/* Metrik 2: Katılanlar (Mevcut) */}
          <div className="p-2.5 sm:p-3 bg-white dark:bg-[#1E222B] rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 truncate">
                Sınava Katılan
              </div>
              <div className="flex flex-wrap items-baseline gap-1 mt-0.5">
                <span className="text-base sm:text-xl font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
                  {summaryStats.totalPresent}
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 dark:text-emerald-500 font-mono">
                  (%{summaryStats.attendanceRate})
                </span>
              </div>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 ml-1">
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          {/* Metrik 3: Devamsızlar (Gelmeyen) */}
          <div className="p-2.5 sm:p-3 bg-white dark:bg-[#1E222B] rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 truncate">
                Devamsız Öğrenci
              </div>
              <div className="flex flex-wrap items-baseline gap-1 mt-0.5">
                <span className="text-base sm:text-xl font-bold text-rose-700 dark:text-rose-400 font-mono tabular-nums">
                  {summaryStats.totalAbsent}
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-rose-600 dark:text-rose-500 font-mono">
                  (%{summaryStats.absentRate})
                </span>
              </div>
            </div>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 ml-1">
              <UserX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>

          {/* Metrik 4: Salon Teslim Durumu */}
          <div className="p-2.5 sm:p-3 bg-white dark:bg-[#1E222B] rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                Salon Teslimatı
              </div>
              <div className="flex flex-wrap items-baseline gap-1 mt-0.5">
                <span className="text-base sm:text-xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
                  {summaryStats.submittedHalls}/{summaryStats.totalHalls}
                </span>
                <span className={`text-[10px] sm:text-[11px] font-medium truncate ${
                  summaryStats.allSubmitted ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                }`}>
                  {summaryStats.allSubmitted ? '✓ Tamam' : 'Bekleniyor'}
                </span>
              </div>
            </div>
            <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 ml-1 ${
              summaryStats.allSubmitted
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
            }`}>
              {summaryStats.allSubmitted ? <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </div>
          </div>
        </div>

        {/* CANLI ARAMA ÇUBUĞU */}
        <div className="px-3.5 py-2 sm:px-5 sm:py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#15171C]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Öğrenci adı, no, sınıf veya salon ara..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs rounded-md"
                aria-label="Aramayı Temizle"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* MODAL İÇERİK BÖLÜMÜ (SCROLLABLE TABLOLAR & MOBİL KARTLAR) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3.5">
          {!selectedExam ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 my-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
                <Clock className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Bugün İçin Planlanmış Aktif Sınav Bulunmuyor
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                Öğretmen kullanıcılar yalnızca sınav günlerinde anlık yoklama alabilir ve sınıfların yoklama tutanaklarını canlı olarak görüntüleyebilir. Geçmiş sınav kayıtları ve arşiv idareci yetkisindedir.
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'halls' && (
                <div className="space-y-3">
              {filteredHallReports.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  {searchQuery ? 'Aramanıza uygun salon veya devamsız öğrenci bulunamadı.' : 'Bu sınava atanmış salon bulunmuyor.'}
                </div>
              ) : (
                filteredHallReports.map(hallReport => (
                  <div
                    key={hallReport.hallId}
                    className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#1A1D24] overflow-hidden transition-all shadow-2xs hover:border-slate-300 dark:hover:border-slate-700"
                  >
                    {/* Salon Kart Başlığı */}
                    <div className="p-3 sm:px-4 bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 font-bold shrink-0">
                          <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                              {hallReport.hallName}
                            </h3>
                            {hallReport.isSubmitted ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                Teslim Edildi
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                Bekleniyor
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span>Gözetmen: <strong>{hallReport.supervisorName}</strong></span>
                            {hallReport.submittedAt && (
                              <>
                                <span>·</span>
                                <span>Saat: {new Date(hallReport.submittedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Katılım Sayıları - Mobil Duyarlı Rozetler */}
                      <div className="flex items-center justify-between sm:justify-end gap-1.5 sm:gap-2.5 text-xs w-full sm:w-auto font-mono tabular-nums pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 dark:border-slate-800/60">
                        <span className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px]">
                          Toplam: <strong className="text-slate-900 dark:text-white">{hallReport.totalAssigned}</strong>
                        </span>
                        <span className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                          Katılan: {hallReport.presentCount}
                        </span>
                        <span className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
                          hallReport.absentCount > 0 
                            ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>
                          Gelmeyen: {hallReport.absentCount}
                        </span>
                      </div>
                    </div>

                    {/* Devamsız Öğrenciler: Mobil Kart Listesi & Masaüstü Tablo */}
                    <div className="p-3 sm:p-4">
                      {hallReport.isSubmitted ? (
                        hallReport.absentStudents.length > 0 ? (
                          <>
                            {/* MOBİL GÖRÜNÜM: Kart Listesi (Dar ekranda yatay taşmayı önler, tek bakışta okunur) */}
                            <div className="block sm:hidden space-y-2">
                              {hallReport.absentStudents.map(student => (
                                <div 
                                  key={`${student.studentId}_${student.deskNumber}`}
                                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                                        Sıra {student.deskNumber}
                                      </span>
                                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                                        #{student.studentNo}
                                      </span>
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                        {student.studentClass || '-'}
                                      </span>
                                    </div>
                                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 mt-1 truncate">
                                      {student.studentName}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-1 rounded-lg border border-rose-200 dark:border-rose-900 shrink-0">
                                    Devamsız
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* MASAÜSTÜ GÖRÜNÜM: Standart Detaylı Tablo */}
                            <div className="hidden sm:block overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                                    <th className="pb-2 w-16 text-center">Sıra No</th>
                                    <th className="pb-2 w-20 text-center">Öğrenci No</th>
                                    <th className="pb-2">Adı Soyadı</th>
                                    <th className="pb-2 w-24">Sınıfı</th>
                                    <th className="pb-2 w-28 text-right">Durum</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-200">
                                  {hallReport.absentStudents.map(student => (
                                    <tr key={`${student.studentId}_${student.deskNumber}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                      <td className="py-2 text-center font-mono text-slate-500">
                                        {student.deskNumber}
                                      </td>
                                      <td className="py-2 text-center font-mono font-bold text-slate-900 dark:text-white">
                                        {student.studentNo}
                                      </td>
                                      <td className="py-2 font-semibold">
                                        {student.studentName}
                                      </td>
                                      <td className="py-2">
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                                          {student.studentClass || '-'}
                                        </span>
                                      </td>
                                      <td className="py-2 text-right">
                                        <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900">
                                          Gelmedi (Devamsız)
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </>
                        ) : (
                          <div className="py-2 text-center text-xs text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                            ✓ Bu salonda tüm öğrenciler ({hallReport.totalAssigned} kişi) eksiksiz olarak sınava katılmıştır.
                          </div>
                        )
                      ) : (
                        <div className="py-2 text-center text-xs text-amber-700 dark:text-amber-400 font-medium bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40">
                          ⏳ Bu salon için gözetmen tarafından henüz nihai yoklama teslim edilmemiştir.
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* SEKME B: SINIF / ŞUBEYE GÖRE DEVAMSIZLAR (e-Okul Uyumlu) */}
          {activeTab === 'classes' && (
            <div className="space-y-3.5">
              {filteredClassGroupedAbsentees.length === 0 ? (
                <div className="p-8 text-center bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 rounded-2xl">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto mb-3 shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Kayıtlı Devamsız Öğrenci Yok!
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 max-w-md mx-auto">
                    Yoklaması tamamlanan tüm salonlarda öğrenciler eksiksiz katılmıştır veya henüz devamsız bildirilmemiştir.
                  </p>
                </div>
              ) : (
                filteredClassGroupedAbsentees.map(classGroup => (
                  <div
                    key={classGroup.className}
                    className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-[#1A1D24] overflow-hidden shadow-2xs"
                  >
                    {/* Sınıf Başlığı */}
                    <div className="px-3.5 py-2.5 sm:px-4 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
                          {classGroup.className.split('-')[0] || '8'}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {classGroup.className} Şubesi Devamsızları
                        </h4>
                      </div>
                      <span className="text-xs font-bold font-mono text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
                        {classGroup.students.length} Devamsız
                      </span>
                    </div>

                    {/* Sınıfın Devamsız Öğrenci Listesi */}
                    <div className="p-3 sm:p-4">
                      {/* MOBİL GÖRÜNÜM: Kart Listesi */}
                      <div className="block sm:hidden space-y-2">
                        {classGroup.students.map((st, idx) => (
                          <div 
                            key={`${st.studentNo}_${st.hallName}`}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                                  No: {st.studentNo}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900">
                                Gelmedi
                              </span>
                            </div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {st.studentName}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                              <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                                <Building className="w-3 h-3 text-indigo-500" />
                                {st.hallName} (Sıra: {st.deskNumber})
                              </span>
                              <span className="truncate max-w-[130px] text-[10px]">
                                Gözetmen: {st.supervisorName}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* MASAÜSTÜ GÖRÜNÜM: Standart Tablo */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400">
                              <th className="pb-2 w-10 text-center">#</th>
                              <th className="pb-2 w-20 text-center">Öğrenci No</th>
                              <th className="pb-2">Adı Soyadı</th>
                              <th className="pb-2">Bulunduğu Sınav Salonu</th>
                              <th className="pb-2 w-16 text-center">Sıra No</th>
                              <th className="pb-2">Salon Gözetmeni</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-200">
                            {classGroup.students.map((st, idx) => (
                              <tr key={`${st.studentNo}_${st.hallName}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                <td className="py-2 text-center text-slate-400 font-mono">
                                  {idx + 1}
                                </td>
                                <td className="py-2 text-center font-mono font-bold text-slate-900 dark:text-white">
                                  {st.studentNo}
                                </td>
                                <td className="py-2 font-semibold">
                                  {st.studentName}
                                </td>
                                <td className="py-2 font-medium text-slate-800 dark:text-slate-200">
                                  {st.hallName}
                                </td>
                                <td className="py-2 text-center font-mono text-slate-500">
                                  {st.deskNumber}
                                </td>
                                <td className="py-2 text-slate-500 text-[11px]">
                                  {st.supervisorName}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ))
              )}
              </div>
            )}
          </>
        )}
      </div>

        {/* MODAL FOOTER */}
        <footer className="px-3.5 py-2.5 sm:px-5 sm:py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#1A1D24] flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-500">
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
              Veriler anlık bildirimler ve yerel bellek ile senkronize edilmektedir.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold transition-colors cursor-pointer text-center touch-manipulation"
          >
            Kapat
          </button>
        </footer>
      </div>
    </div>
  );
};
