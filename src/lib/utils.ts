import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import * as XLSX from "xlsx";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeForSearch(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toString()
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/ı/g, "i")
    .replace(/i̇/g, "i")
    .replace(/Ş/g, "s")
    .replace(/ş/g, "s")
    .replace(/Ç/g, "c")
    .replace(/ç/g, "c")
    .replace(/Ğ/g, "g")
    .replace(/ğ/g, "g")
    .replace(/Ü/g, "u")
    .replace(/ü/g, "u")
    .replace(/Ö/g, "o")
    .replace(/ö/g, "o")
    .toLowerCase()
    .trim();
}

export function exportToExcel(data: any[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function importFromExcel(file: File, callback: (data: any[]) => void) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = e.target?.result;
    const workbook = XLSX.read(data, { type: "binary" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const parsedData = XLSX.utils.sheet_to_json(sheet);
    callback(parsedData);
  };
  reader.readAsBinaryString(file);
}

export function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export function parseDateObj(dateStr: string | null | undefined): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Try parsing DD.MM.YYYY, DD/MM/YYYY, or DD-MM-YYYY
  const delimiterMatch = trimmed.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (delimiterMatch) {
    const day = parseInt(delimiterMatch[1], 10);
    const month = parseInt(delimiterMatch[2], 10);
    let year = parseInt(delimiterMatch[3], 10);
    if (year < 100) year += 2000;
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Handle YYYY-MM-DD if starts with 4 digits
  const isoMatch = trimmed.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // If not parsed yet, parse natural TR text like "12 Ekim 2025" or "12 Ekim 2025 Pazar"
  const monthsTR: Record<string, number> = {
    'ocak': 0, 'şubat': 1, 'subat': 1, 'mart': 2, 'nisan': 3, 'mayıs': 4, 'mayis': 4,
    'haziran': 5, 'temmuz': 6, 'ağustos': 7, 'agustos': 7, 'eylül': 8, 'eylul': 8,
    'ekim': 9, 'kasım': 10, 'kasim': 10, 'aralık': 11, 'aralik': 11
  };
  const cleanStr = trimmed.toLowerCase().replace(/[^a-z0-9şğüöçı]/g, ' ');
  const tokens = cleanStr.split(/\s+/).filter(Boolean);
  let day = 1;
  let month = -1;
  let year = 0;

  tokens.forEach(token => {
    if (/^\d{1,2}$/.test(token) && parseInt(token, 10) <= 31 && day === 1) {
      day = parseInt(token, 10);
    } else if (/^\d{4}$/.test(token)) {
      year = parseInt(token, 10);
    } else if (monthsTR[token] !== undefined) {
      month = monthsTR[token];
    }
  });

  if (year > 0 && month >= 0) {
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

export function formatDateLong(dateStr: string | null | undefined): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const d = parseDateObj(dateStr);
  if (d) {
    return d.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      weekday: 'long'
    });
  }
  return dateStr.trim();
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  const d = parseDateObj(dateStr);
  if (d) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }
  return dateStr.trim();
}

export const calculateAtaLigPoints = (examScore: number, previousAverage: number, lessonsDetails: any, historyExams: any[] = [], team: string = '') => {
  let earnedLP = 0;
  const earnedBadges: string[] = [];
  const badgeCounts = { kalkan: 0, ivme: 0, zirve: 0, tamIsabet: 0, kirmiziKart: 0, zirveBekcisi: 0, ivmeSampiyonu: 0, barajYikici: 0, stratejiMuhendisi: 0, istikrarElcisi: 0, lgsFatihi: 0, ankaKusu: 0 , sozelSovalyesi: 0, sayisalKalesi: 0, matematikUyanisi: 0, dengeCambazi: 0, keskinNisanci: 0, temelAtici: 0, uyuyanDev: 0, sabirTasi: 0, yinYang: 0, filozof: 0, newton: 0, pisagor: 0 };
  
  let totalD = 0;
  let totalY = 0;
  let totalB = 0;
  let mathNet = 0;

  let inkY = 0, dinY = 0, ingY = 0;
  let matD = 0, matY = 0, fenD = 0, fenY = 0, turkD = 0, turkY = 0;
  let matN = 0, turkN = 0, fenN = 0, inkN = 0, dinN = 0;
  let allNetNonNegative = true;

  if (lessonsDetails) {
    Object.values(lessonsDetails).forEach((lesson: any) => {
      const name = (lesson.name || lesson.lessonName || '').toLowerCase();
      const lD = lesson.D || 0;
      const lY = lesson.Y || 0;
      let lN = lesson.N !== undefined ? lesson.N : (lesson.net !== undefined ? lesson.net : (lesson.n !== undefined ? lesson.n : (lD - lY / 3)));
      
      if (lN < 0) allNetNonNegative = false;
      
      if (name.includes('ink')) { inkY += lY; inkN = lN; }
      if (name.includes('din')) { dinY += lY; dinN = lN; }
      if (name.includes('ing')) { ingY += lY; }
      if (name.includes('mat')) { matD = lD; matY += lY; matN = lN; }
      if (name.includes('fen')) { fenD = lD; fenY += lY; fenN = lN; }
      if (name.includes('tür') || name.includes('turk') || name === 'türkçe') { turkD = lD; turkY = lY; turkN = lN; }

      totalD += lesson.D || 0;
      totalY += lesson.Y || 0;
      totalB += lesson.B || 0;
      
      // Tam İsabet (+10 LP): Y === 0 and D > 0
      if (lesson.Y === 0 && (lesson.D || 0) > 0) {
        earnedLP += 10;
        badgeCounts.tamIsabet += 1;
        earnedBadges.push('Tam İsabet');
      }

      if (name.includes('mat')) {
        if (lesson.N !== undefined) mathNet = lesson.N;
        else if (lesson.net !== undefined) mathNet = lesson.net;
        else if (lesson.n !== undefined) mathNet = lesson.n;
        else mathNet = (lesson.D || 0) - ((lesson.Y || 0) / 3);
      }
    });
  }

  const hasKirmiziKart = totalY >= 15 && team === 'Kutup Yıldızları';
  const hasKalkan = totalB > totalY && totalB > 0;
  const isLgsFatihi = totalD > 0 && totalY === 0 && totalB === 0;

  if (isLgsFatihi) {
     earnedLP += 200;
     badgeCounts.lgsFatihi += 1;
     earnedBadges.push('LGS Fatihi');
  }

  // Kırmızı Kart (-15 LP) or Kalkan Puanı (+20 LP)
  if (hasKirmiziKart) {
    earnedLP -= 15;
    badgeCounts.kirmiziKart += 1;
    earnedBadges.push('Kırmızı Kart');
  } else if (hasKalkan) {
    earnedLP += 20;
    badgeCounts.kalkan += 1;
    earnedBadges.push('Kalkan');
  }

  // Team Specific Badges
  if (team === 'Kutup Yıldızları') {
    if (inkY + dinY + ingY === 0 && totalD > 0) {
      earnedLP += 15;
      badgeCounts.sozelSovalyesi += 1;
      earnedBadges.push('Sözel Şövalyesi');
    }
    if (matY + fenY <= 2 && totalD > 0) {
      earnedLP += 20;
      badgeCounts.sayisalKalesi += 1;
      earnedBadges.push('Sayısal Kalesi');
    }
  } else if (team === 'Sıçrama Ustaları') {
    if (matN >= 10) {
      earnedLP += 20;
      badgeCounts.matematikUyanisi += 1;
      earnedBadges.push('Matematik Uyanışı');
    }
    if (turkN >= 15 && fenN >= 15) {
      earnedLP += 15;
      badgeCounts.dengeCambazi += 1;
      earnedBadges.push('Denge Cambazı');
    }
  } else if (team === 'Taktik Avcıları') {
    if (totalD + totalY > 0 && (totalD / (totalD + totalY)) >= 0.70) {
      earnedLP += 20;
      badgeCounts.keskinNisanci += 1;
      earnedBadges.push('Keskin Nişancı');
    }
    if (allNetNonNegative) {
      earnedLP += 15;
      badgeCounts.temelAtici += 1;
      earnedBadges.push('Temel Atıcı');
    }
  }

  // Zirve Koruma (+15 LP)
  if (examScore >= 400 && team !== 'Kutup Yıldızları' && team !== 'Atanmadı') {
    earnedLP += 15;
    badgeCounts.zirve += 1;
    earnedBadges.push('Zirve Koruma');
  }

  // İvme Puanı (+15 LP)
  if (previousAverage > 0 && examScore >= previousAverage + 2) {
    earnedLP += 15;
    badgeCounts.ivme += 1;
    earnedBadges.push('İvme');
  }

  // Process history for consecutive badges
  const hasZirve = examScore >= 400 && team !== 'Kutup Yıldızları' && team !== 'Atanmadı';
  const currentExamFormatted = { score: examScore, hasKalkan, hasKirmiziKart, mathNet, hasZirve };
  const fullHistory = [...historyExams.map(h => {
    let hTotalY = 0; let hTotalB = 0; let hMathNet = 0;
    if (h.details) {
      Object.values(h.details).forEach((l: any) => {
        hTotalY += l.Y || 0;
        hTotalB += l.B || 0;
        const name = (l.name || l.lessonName || '').toLowerCase();
        if (name.includes('mat')) {
          if (l.N !== undefined) hMathNet = l.N;
          else if (l.net !== undefined) hMathNet = l.net;
          else if (l.n !== undefined) hMathNet = l.n;
          else hMathNet = (l.D || 0) - ((l.Y || 0) / 3);
        }
      });
    }
    return { 
      score: h.score, 
      hasKalkan: hTotalB > hTotalY && hTotalB > 0, 
      totalY: hTotalY,
      mathNet: hMathNet
    };
  }).map((h, i, arr) => {
    const pastExams = arr.slice(0, i);
    const prevAvg = pastExams.length > 0 ? (pastExams.reduce((sum, p) => sum + p.score, 0) / pastExams.length) : 0;
    let hTeam = pastExams.length > 0 ? determineLeagueTeam(prevAvg) : 'Taktik Avcıları';
    if (hTeam === 'Atanmadı') hTeam = 'Taktik Avcıları';
    return {
       ...h,
       hasKirmiziKart: h.totalY >= 15 && hTeam === 'Kutup Yıldızları',
       hasZirve: h.score >= 400 && hTeam !== 'Kutup Yıldızları' && true
    };
  }), currentExamFormatted];

  const getStreak = (condition: (item: any, i: number, arr: any[]) => boolean) => {
    let streak = 0;
    for (let i = fullHistory.length - 1; i >= 0; i--) {
      if (condition(fullHistory[i], i, fullHistory)) streak++;
      else break;
    }
    return streak;
  };

  // Zirve Bekçisi (+30 LP): 3 consecutive Zirve
  const zirveStreak = getStreak(h => h.hasZirve);
  if (zirveStreak > 0 && zirveStreak % 3 === 0) {
    earnedLP += 30;
    badgeCounts.zirveBekcisi += 1;
    earnedBadges.push('Zirve Bekçisi');
  }

  // İvme Şampiyonu (+30 LP): 3 consecutive with +5 score increase
  const ivmeStreak = getStreak((h, i, arr) => {
    if (i === 0) return false;
    return h.score >= arr[i - 1].score + 5;
  });
  if (ivmeStreak > 0 && ivmeStreak % 3 === 0) {
    earnedLP += 30;
    badgeCounts.ivmeSampiyonu += 1;
    earnedBadges.push('İvme Şampiyonu');
  }

  // Baraj Yıkıcı (+30 LP): 3 consecutive Math Net > 10
  const barajStreak = getStreak(h => h.mathNet >= 10);
  if (barajStreak > 0 && barajStreak % 3 === 0) {
    earnedLP += 30;
    badgeCounts.barajYikici += 1;
    earnedBadges.push('Baraj Yıkıcı');
  }

  // Strateji Mühendisi (+40 LP): 4 consecutive Kalkan
  const stratejiStreak = getStreak(h => h.hasKalkan);
  if (stratejiStreak > 0 && stratejiStreak % 4 === 0) {
    earnedLP += 40;
    badgeCounts.stratejiMuhendisi += 1;
    earnedBadges.push('Strateji Mühendisi');
  }

  // İstikrar Elçisi (+50 LP): 5 consecutive no Kırmızı Kart
  const istikrarStreak = getStreak(h => !h.hasKirmiziKart);
  if (istikrarStreak > 0 && istikrarStreak % 5 === 0) {
    earnedLP += 50;
    badgeCounts.istikrarElcisi += 1;
    earnedBadges.push('İstikrar Elçisi');
  }

  // --- Yeni Gizemli ve Branş Rozetleri ---

  // Uyuyan Dev (+50 LP)
  if (previousAverage > 0 && (examScore - previousAverage) >= 40) {
    earnedLP += 50;
    badgeCounts.uyuyanDev += 1;
    earnedBadges.push('Uyuyan Dev');
  }

  // Sabır Taşı (+40 LP)
  if (totalB >= 15 && totalY === 0) {
    earnedLP += 40;
    badgeCounts.sabirTasi += 1;
    earnedBadges.push('Sabır Taşı');
  }

  // Yin Yang (+30 LP)
  if (turkN === matN && matN >= 10) {
    earnedLP += 30;
    badgeCounts.yinYang += 1;
    earnedBadges.push('Yin Yang');
  }

  // Filozof (+30 LP)
  if (turkD === 20 && turkY === 0) {
    earnedLP += 30;
    badgeCounts.filozof += 1;
    earnedBadges.push('Filozof');
  }

  // Newton (+30 LP)
  if (fenD === 20 && fenY === 0) {
    earnedLP += 30;
    badgeCounts.newton += 1;
    earnedBadges.push('Newton');
  }

  // Pisagor (+50 LP)
  if (matD === 20 && matY === 0) {
    earnedLP += 50;
    badgeCounts.pisagor += 1;
    earnedBadges.push('Pisagor');
  }

  return { earnedLP, earnedBadges, badgeCounts };
};

export function determineLeagueTeam(average: number): 'Kutup Yıldızları' | 'Sıçrama Ustaları' | 'Taktik Avcıları' | 'Atanmadı' {
  if (average >= 400) return 'Kutup Yıldızları';
  if (average >= 300) return 'Sıçrama Ustaları';
  if (average > 0) return 'Taktik Avcıları';
  return 'Atanmadı';
}


export function parseDate(dateStr: string | undefined): Date {
  if (!dateStr) return new Date();
  const parsed = parseDateObj(dateStr);
  if (parsed) return parsed;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}
export function recalculateLeagueForStudents(students: any[], results: any[], exams: any[], approvedTransfers: any[] = []) {
  const sortedExams = [...exams].sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
  
  const studentExamData: Record<number, Record<string, { team: string, participated: boolean }>> = {};
  
  const firstPass = students.map(student => {
    const result = results.find(r => r.studentNo === student.no && student.no !== 0);
    
    let totalLP = 0;
    let currentTeam = 'Atanmadı';
    let lastTransfer = '';
    const transferHistory: any[] = [];
    let pendingTransfer: any = null;
    const badges: Record<string, number> = { kalkan: 0, ivme: 0, zirve: 0, tamIsabet: 0, kirmiziKart: 0, zirveBekcisi: 0, ivmeSampiyonu: 0, barajYikici: 0, stratejiMuhendisi: 0, istikrarElcisi: 0, lgsFatihi: 0, ankaKusu: 0 };
    const monthlyLeagueData: Record<string, { points: number, badges: Record<string, number> }> = {};
    
    studentExamData[student.no] = {};

    if (result && result.scores) {
      const historyExamsForStudent: any[] = [];
      let runningSum = 0;
      let count = 0;
      
      for (const exam of sortedExams) {
        const participated = result.scores[exam.name] !== undefined && result.scores[exam.name] > 0;
        let teamForThisExam = count > 0 ? determineLeagueTeam(runningSum / count) : 'Taktik Avcıları';
        if (teamForThisExam === 'Atanmadı') teamForThisExam = 'Taktik Avcıları';
        
        studentExamData[student.no][exam.name] = {
           team: teamForThisExam,
           participated
        };
        
        if (participated) {
          const score = result.scores[exam.name];
          const details = result.details?.[exam.name]?.lessons;
          const prevAverage = count > 0 ? (runningSum / count) : 0;
          
          const { earnedLP, badgeCounts } = calculateAtaLigPoints(score, prevAverage, details, historyExamsForStudent, teamForThisExam);
          
          totalLP += earnedLP;
          Object.keys(badgeCounts).forEach(k => {
             badges[k] += badgeCounts[k as keyof typeof badgeCounts];
          });
          
          // Track monthly points and badges based on exam.date
          const dateObj = parseDate(exam.date);
          const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyLeagueData[monthKey]) {
            monthlyLeagueData[monthKey] = {
              points: 0,
              badges: { kalkan: 0, ivme: 0, zirve: 0, tamIsabet: 0, kirmiziKart: 0, zirveBekcisi: 0, ivmeSampiyonu: 0, barajYikici: 0, stratejiMuhendisi: 0, istikrarElcisi: 0, lgsFatihi: 0, ankaKusu: 0, sozelSovalyesi: 0, sayisalKalesi: 0, matematikUyanisi: 0, dengeCambazi: 0, keskinNisanci: 0, temelAtici: 0 }
            };
          }
          monthlyLeagueData[monthKey].points += earnedLP;
          Object.keys(badgeCounts).forEach(k => {
            if (monthlyLeagueData[monthKey].badges[k] !== undefined) {
               monthlyLeagueData[monthKey].badges[k] += badgeCounts[k as keyof typeof badgeCounts];
            } else {
               monthlyLeagueData[monthKey].badges[k] = badgeCounts[k as keyof typeof badgeCounts];
            }
          });
          
          let hTotalY = 0; let hTotalB = 0; let hMathNet = 0;
          if (details) {
            Object.values(details).forEach((l: any) => {
              hTotalY += l.Y || 0;
              hTotalB += l.B || 0;
              const lname = (l.name || l.lessonName || '').toLowerCase();
              if (lname.includes('mat')) {
                if (l.N !== undefined) hMathNet = l.N;
                else if (l.net !== undefined) hMathNet = l.net;
                else if (l.n !== undefined) hMathNet = l.n;
                else hMathNet = (l.D || 0) - ((l.Y || 0) / 3);
              }
            });
          }

          historyExamsForStudent.push({
            name: exam.name,
            score,
            details,
            date: exam.date,
            totalY: hTotalY,
            hasKalkan: hTotalB > hTotalY && hTotalB > 0,
            hasKirmiziKart: hTotalY >= 15 && teamForThisExam === 'Kutup Yıldızları',
            mathNet: hMathNet,
            hasZirve: score >= 400 && teamForThisExam !== 'Kutup Yıldızları' && true
          });
          
          runningSum += score;
          count++;
          
          const newTeam = determineLeagueTeam(runningSum / count);
          if (currentTeam !== 'Atanmadı' && currentTeam !== newTeam) {
             const isApproved = approvedTransfers.some(a => a.studentNo === student.no && a.examName === exam.name && a.toTeam === newTeam);
             if (isApproved) {
                 lastTransfer = `${currentTeam} ➔ ${newTeam}`;
                 transferHistory.push({ from: currentTeam, to: newTeam, date: exam.date, examName: exam.name });
                 
                 if (currentTeam === 'Taktik Avcıları' && (newTeam === 'Sıçrama Ustaları' || newTeam === 'Kutup Yıldızları')) {
                     totalLP += 100;
                     badges.ankaKusu += 1;
                     
                     // Track transfer bonus in monthly stats
                     const tDateObj = parseDate(exam.date);
                     const tMonthKey = `${tDateObj.getFullYear()}-${String(tDateObj.getMonth() + 1).padStart(2, '0')}`;
                     if (!monthlyLeagueData[tMonthKey]) {
                       monthlyLeagueData[tMonthKey] = {
                         points: 0,
                         badges: { kalkan: 0, ivme: 0, zirve: 0, tamIsabet: 0, kirmiziKart: 0, zirveBekcisi: 0, ivmeSampiyonu: 0, barajYikici: 0, stratejiMuhendisi: 0, istikrarElcisi: 0, lgsFatihi: 0, ankaKusu: 0, sozelSovalyesi: 0, sayisalKalesi: 0, matematikUyanisi: 0, dengeCambazi: 0, keskinNisanci: 0, temelAtici: 0 }
                       };
                     }
                     monthlyLeagueData[tMonthKey].points += 100;
                     monthlyLeagueData[tMonthKey].badges.ankaKusu += 1;
                 }
                 
                 currentTeam = newTeam;
                 pendingTransfer = null;
             } else if (count % 5 === 0) {
                 pendingTransfer = { from: currentTeam, to: newTeam, date: exam.date, examName: exam.name };
             }
          } else {
             if (currentTeam === 'Atanmadı') {
                 currentTeam = newTeam;
             }
             pendingTransfer = null;
          }
        }
      }
    }
    
    if (currentTeam === 'Atanmadı') currentTeam = 'Taktik Avcıları';

    return {
      ...student,
      leaguePoints: totalLP,
      leagueTeam: currentTeam,
      lastTransfer,
      transferHistory,
      pendingTransfer,
      badges,
      monthlyLeagueData
    };
  });
  
  return firstPass;
}

export { getStudentInfoFit, getStudentNameFontSize } from './studentTextFit';

