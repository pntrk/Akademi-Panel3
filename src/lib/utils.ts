import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import * as XLSX from "xlsx";
import { normalizeTurkish } from './omrEngine';
export { normalizeTurkish };

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

export function exportAoaToExcel(
  aoa: any[][],
  filename: string,
  options?: {
    sheetName?: string;
    merges?: any[];
    cols?: any[];
  }
) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (options?.merges) ws['!merges'] = options.merges;
  if (options?.cols) ws['!cols'] = options.cols;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, options?.sheetName || "Kurum Net Listesi");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function importFromExcel(file: File, callback: (data: any[], rawRows?: any[][]) => void) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const buffer = e.target?.result as ArrayBuffer;
      let workbook: XLSX.WorkBook;
      const fileName = file.name.toLowerCase();

      // Check if file is XML (either by extension or <?xml / <Workbook header)
      const u8 = new Uint8Array(buffer);
      const isXml = fileName.endsWith('.xml') ||
        (u8[0] === 0x3C && u8[1] === 0x3F) || // <?xml
        (u8[0] === 0x3C && (u8[1] === 0x57 || u8[1] === 0x77)); // <Workbook

      if (isXml) {
        let text = '';
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        } catch {
          try {
            text = new TextDecoder('windows-1254').decode(buffer);
          } catch {
            text = new TextDecoder('iso-8859-9').decode(buffer);
          }
        }
        workbook = XLSX.read(text, { type: "string" });
      } else {
        try {
          workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
        } catch {
          const text = new TextDecoder('utf-8').decode(buffer);
          workbook = XLSX.read(text, { type: "string" });
        }
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const parsedData = XLSX.utils.sheet_to_json(sheet);
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[][];
      callback(parsedData, rawRows);
    } catch (err) {
      console.warn('importFromExcel primary read notice, trying fallback:', err);
      try {
        const binReader = new FileReader();
        binReader.onload = (be) => {
          const bData = be.target?.result;
          const wb = XLSX.read(bData, { type: "binary" });
          const sn = wb.SheetNames[0];
          const sh = wb.Sheets[sn];
          callback(XLSX.utils.sheet_to_json(sh), XLSX.utils.sheet_to_json(sh, { header: 1, raw: false }) as any[][]);
        };
        binReader.readAsBinaryString(file);
      } catch (e2) {
        callback([], []);
      }
    }
  };
  reader.readAsArrayBuffer(file);
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

/**
 * 1. Dönem: Eylül (8) - Ocak (0) ayları arası
 * 2. Dönem: Şubat (1) - Haziran (5) ayları arası
 */
export function getExamTerm(exam: { date?: string; name?: string }): 1 | 2 | null {
  if (exam.date) {
    const d = parseDateObj(exam.date);
    if (d) {
      const m = d.getMonth();
      // 1. Dönem: Eylül(8), Ekim(9), Kasım(10), Aralık(11), Ocak(0)
      if (m === 8 || m === 9 || m === 10 || m === 11 || m === 0) {
        return 1;
      }
      // 2. Dönem: Şubat(1), Mart(2), Nisan(3), Mayıs(4), Haziran(5)
      if (m >= 1 && m <= 5) {
        return 2;
      }
    }
  }

  // Fallback checks on exam name or date raw string
  const str = `${exam.name || ''} ${exam.date || ''}`.toLowerCase();
  if (
    str.includes('1. dönem') || str.includes('1.dönem') || str.includes('1. donem') ||
    str.includes('1.donem') || str.includes('i. dönem') || str.includes('i.donem') ||
    str.includes('eylül') || str.includes('eylul') || str.includes('ekim') ||
    str.includes('kasım') || str.includes('kasim') || str.includes('aralık') ||
    str.includes('aralik') || str.includes('ocak')
  ) {
    return 1;
  }
  if (
    str.includes('2. dönem') || str.includes('2.dönem') || str.includes('2. donem') ||
    str.includes('2.donem') || str.includes('ii. dönem') || str.includes('ii.donem') ||
    str.includes('şubat') || str.includes('subat') || str.includes('mart') ||
    str.includes('nisan') || str.includes('mayıs') || str.includes('mayis') ||
    str.includes('haziran')
  ) {
    return 2;
  }
  return null;
}

export function isExamInTerm1(exam: { date?: string; name?: string }): boolean {
  return getExamTerm(exam) === 1;
}

export function isExamInTerm2(exam: { date?: string; name?: string }): boolean {
  return getExamTerm(exam) === 2;
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

  if (lessonsDetails && typeof lessonsDetails === 'object') {
    Object.entries(lessonsDetails).forEach(([k, lesson]: [string, any]) => {
      if (!lesson || typeof lesson !== 'object') return;
      const name = normalizeForSearch(lesson.name || lesson.lessonName || k || '');
      const lD = lesson.D !== undefined ? Number(lesson.D) : (lesson.correct !== undefined ? Number(lesson.correct) : 0);
      const lY = lesson.Y !== undefined ? Number(lesson.Y) : (lesson.wrong !== undefined ? Number(lesson.wrong) : 0);
      const lB = lesson.B !== undefined ? Number(lesson.B) : (lesson.empty !== undefined ? Number(lesson.empty) : 0);
      let lN = lesson.N !== undefined ? Number(lesson.N) : (lesson.net !== undefined ? Number(lesson.net) : (lesson.n !== undefined ? Number(lesson.n) : (lD - lY / 3)));
      
      if (lN < 0) allNetNonNegative = false;
      
      if (name.includes('ink') || name.includes('tarih') || name.includes('sosyal')) { inkY += lY; inkN = lN; }
      if (name.includes('din') || name.includes('dkab')) { dinY += lY; dinN = lN; }
      if (name.includes('ing') || name.includes('yabanci') || name.includes('dil')) { ingY += lY; }
      if (name.includes('mat')) { matD = lD; matY += lY; matN = lN; }
      if (name.includes('fen')) { fenD = lD; fenY += lY; fenN = lN; }
      if (name.includes('tur')) { turkD = lD; turkY = lY; turkN = lN; }

      totalD += lD;
      totalY += lY;
      totalB += lB;
      
      // Tam İsabet (+10 LP): 0 Yanlış ve en az 1 Doğru
      if (lY === 0 && lD > 0) {
        earnedLP += 10;
        badgeCounts.tamIsabet += 1;
        earnedBadges.push('Tam İsabet');
      }

      if (name.includes('mat')) {
        if (lesson.N !== undefined) mathNet = Number(lesson.N);
        else if (lesson.net !== undefined) mathNet = Number(lesson.net);
        else if (lesson.n !== undefined) mathNet = Number(lesson.n);
        else mathNet = lD - (lY / 3);
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
export function recalculateLeagueForStudents(students: any[], results: any[] = [], exams: any[] = [], approvedTransfers: any[] = []) {
  const sortedExams = [...exams].sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
  
  const studentExamData: Record<number, Record<string, { team: string, participated: boolean }>> = {};
  
  const firstPass = students.map(student => {
    const sNo = Number(student.no) || 0;
    const sNameNorm = student.name ? normalizeTurkish(student.name).trim().toLowerCase() : '';

    // Global sonuç listesindeki kaydı (varsa)
    const globalResult = (results || []).find((r: any) => {
      const rNo = r.no !== undefined ? Number(r.no) : (r.studentNo !== undefined ? Number(r.studentNo) : undefined);
      if (sNo > 0 && rNo !== undefined && rNo === sNo) return true;
      if (sNameNorm && r.name && normalizeTurkish(r.name).trim().toLowerCase() === sNameNorm) return true;
      return false;
    });
    
    let totalLP = 0;
    let currentTeam = 'Atanmadı';
    let lastTransfer = '';
    const transferHistory: any[] = [];
    let pendingTransfer: any = null;
    const badges: Record<string, number> = { 
      kalkan: 0, ivme: 0, zirve: 0, tamIsabet: 0, kirmiziKart: 0, 
      zirveBekcisi: 0, ivmeSampiyonu: 0, barajYikici: 0, stratejiMuhendisi: 0, istikrarElcisi: 0, 
      lgsFatihi: 0, ankaKusu: 0, sozelSovalyesi: 0, sayisalKalesi: 0, matematikUyanisi: 0, 
      dengeCambazi: 0, keskinNisanci: 0, temelAtici: 0, uyuyanDev: 0, sabirTasi: 0, 
      yinYang: 0, filozof: 0, newton: 0, pisagor: 0 
    };
    const monthlyLeagueData: Record<string, { points: number, badges: Record<string, number> }> = {};
    
    studentExamData[student.no] = {};

    const historyExamsForStudent: any[] = [];
    let runningSum = 0;
    let count = 0;
    
    for (const exam of sortedExams) {
      // 1. Sınavın kendi altındaki results listesinde öğrenciyi ara (Birincil kaynak)
      const examRes = (exam.results || []).find((r: any) => {
        const rNo = r.no !== undefined ? Number(r.no) : (r.studentNo !== undefined ? Number(r.studentNo) : undefined);
        if (sNo > 0 && rNo !== undefined && rNo === sNo) return true;
        if (sNameNorm && r.name && normalizeTurkish(r.name).trim().toLowerCase() === sNameNorm) return true;
        return false;
      });

      // 2. Global sonuç listesinde skor kontrolü
      const scoreInGlobal = globalResult?.scores 
        ? (globalResult.scores[String(exam.id)] ?? globalResult.scores[exam.name]) 
        : undefined;

      const participated = Boolean(examRes) || (scoreInGlobal !== undefined && scoreInGlobal > 0);
      let teamForThisExam = count > 0 ? determineLeagueTeam(runningSum / count) : 'Taktik Avcıları';
      if (teamForThisExam === 'Atanmadı') teamForThisExam = 'Taktik Avcıları';
      
      studentExamData[student.no][exam.name] = {
         team: teamForThisExam,
         participated
      };
      
      if (participated) {
        const score = Number(
          examRes?.evaluatedScore?.total?.lgsScore ?? 
          examRes?.lgsScore ?? 
          examRes?.evaluatedScore?.total?.net ?? 
          examRes?.net ?? 
          examRes?.average ?? 
          scoreInGlobal ?? 
          0
        );
        const rawDetails = examRes?.evaluatedScore?.subjectScores 
          || examRes?.scores 
          || globalResult?.details?.[exam.name]?.lessons 
          || globalResult?.details?.lessons 
          || globalResult?.evaluatedScore?.subjectScores;

        let resolvedDetails = rawDetails;
        if (rawDetails && exam.subjects && Array.isArray(exam.subjects)) {
          const mapped: Record<string, any> = {};
          Object.entries(rawDetails).forEach(([key, val]: [string, any]) => {
            const sub = exam.subjects.find((s: any) => String(s.id) === String(key) || String(s.name) === String(key));
            const subName = sub ? sub.name : key;
            mapped[subName] = { ...(typeof val === 'object' ? val : {}), name: subName };
          });
          resolvedDetails = mapped;
        }

        const prevAverage = count > 0 ? (runningSum / count) : 0;
        const { earnedLP: calcLP, badgeCounts } = calculateAtaLigPoints(score, prevAverage, resolvedDetails, historyExamsForStudent, teamForThisExam);

        // Sınavda önceden hesaplanan rozetler varsa eksiksiz dahil et
        if (Array.isArray(examRes?.earnedBadges)) {
          examRes.earnedBadges.forEach((bName: string) => {
            const norm = normalizeTurkish(bName).toLowerCase().replace(/[\s\.]+/g, '');
            if (norm.includes('tamisabet')) badgeCounts.tamIsabet = Math.max(badgeCounts.tamIsabet || 0, 1);
            else if (norm.includes('kalkan')) badgeCounts.kalkan = Math.max(badgeCounts.kalkan || 0, 1);
            else if (norm.includes('zirvebekcisi')) badgeCounts.zirveBekcisi = Math.max(badgeCounts.zirveBekcisi || 0, 1);
            else if (norm.includes('zirve')) badgeCounts.zirve = Math.max(badgeCounts.zirve || 0, 1);
            else if (norm.includes('ivmesampiyonu')) badgeCounts.ivmeSampiyonu = Math.max(badgeCounts.ivmeSampiyonu || 0, 1);
            else if (norm.includes('ivme')) badgeCounts.ivme = Math.max(badgeCounts.ivme || 0, 1);
            else if (norm.includes('lgsfatih')) badgeCounts.lgsFatihi = Math.max(badgeCounts.lgsFatihi || 0, 1);
            else if (norm.includes('ankakus')) badgeCounts.ankaKusu = Math.max(badgeCounts.ankaKusu || 0, 1);
            else if (norm.includes('kirmizikart')) badgeCounts.kirmiziKart = Math.max(badgeCounts.kirmiziKart || 0, 1);
            else if (norm.includes('barajyikici')) badgeCounts.barajYikici = Math.max(badgeCounts.barajYikici || 0, 1);
            else if (norm.includes('stratejimuhendisi')) badgeCounts.stratejiMuhendisi = Math.max(badgeCounts.stratejiMuhendisi || 0, 1);
            else if (norm.includes('istikrarelcisi')) badgeCounts.istikrarElcisi = Math.max(badgeCounts.istikrarElcisi || 0, 1);
            else if (norm.includes('sozelsovalye')) badgeCounts.sozelSovalyesi = Math.max(badgeCounts.sozelSovalyesi || 0, 1);
            else if (norm.includes('sayisalkale')) badgeCounts.sayisalKalesi = Math.max(badgeCounts.sayisalKalesi || 0, 1);
            else if (norm.includes('matematikuyanis') || norm.includes('matuyanis')) badgeCounts.matematikUyanisi = Math.max(badgeCounts.matematikUyanisi || 0, 1);
            else if (norm.includes('dengecambaz')) badgeCounts.dengeCambazi = Math.max(badgeCounts.dengeCambazi || 0, 1);
            else if (norm.includes('keskinnisan')) badgeCounts.keskinNisanci = Math.max(badgeCounts.keskinNisanci || 0, 1);
            else if (norm.includes('temelatici')) badgeCounts.temelAtici = Math.max(badgeCounts.temelAtici || 0, 1);
            else if (norm.includes('filozof')) badgeCounts.filozof = Math.max(badgeCounts.filozof || 0, 1);
            else if (norm.includes('newton')) badgeCounts.newton = Math.max(badgeCounts.newton || 0, 1);
            else if (norm.includes('pisagor')) badgeCounts.pisagor = Math.max(badgeCounts.pisagor || 0, 1);
            else if (norm.includes('uyuyandev')) badgeCounts.uyuyanDev = Math.max(badgeCounts.uyuyanDev || 0, 1);
            else if (norm.includes('sabirtasi')) badgeCounts.sabirTasi = Math.max(badgeCounts.sabirTasi || 0, 1);
            else if (norm.includes('yinyang')) badgeCounts.yinYang = Math.max(badgeCounts.yinYang || 0, 1);
          });
        }

        const earnedLP = typeof examRes?.earnedLP === 'number' && examRes.earnedLP > 0 ? examRes.earnedLP : calcLP;
        
        totalLP += earnedLP;
        Object.keys(badgeCounts).forEach(k => {
          if (badgeCounts[k as keyof typeof badgeCounts] > 0) {
            badges[k] = (badges[k] || 0) + badgeCounts[k as keyof typeof badgeCounts];
          }
        });
        
        // Track monthly points and badges based on exam.date
        const dateObj = parseDate(exam.date);
        const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyLeagueData[monthKey]) {
          monthlyLeagueData[monthKey] = {
            points: 0,
            badges: { 
              kalkan: 0, ivme: 0, zirve: 0, tamIsabet: 0, kirmiziKart: 0, 
              zirveBekcisi: 0, ivmeSampiyonu: 0, barajYikici: 0, stratejiMuhendisi: 0, istikrarElcisi: 0, 
              lgsFatihi: 0, ankaKusu: 0, sozelSovalyesi: 0, sayisalKalesi: 0, matematikUyanisi: 0, 
              dengeCambazi: 0, keskinNisanci: 0, temelAtici: 0, uyuyanDev: 0, sabirTasi: 0, 
              yinYang: 0, filozof: 0, newton: 0, pisagor: 0 
            }
          };
        }
        monthlyLeagueData[monthKey].points += earnedLP;
        Object.keys(badgeCounts).forEach(k => {
          if (badgeCounts[k as keyof typeof badgeCounts] > 0) {
            monthlyLeagueData[monthKey].badges[k] = (monthlyLeagueData[monthKey].badges[k] || 0) + badgeCounts[k as keyof typeof badgeCounts];
          }
        });
        
        let hTotalY = 0; let hTotalB = 0; let hMathNet = 0;
        if (resolvedDetails) {
          Object.entries(resolvedDetails).forEach(([k, l]: [string, any]) => {
            if (!l || typeof l !== 'object') return;
            const lY = l.Y !== undefined ? Number(l.Y) : (l.wrong !== undefined ? Number(l.wrong) : 0);
            const lB = l.B !== undefined ? Number(l.B) : (l.empty !== undefined ? Number(l.empty) : 0);
            hTotalY += lY;
            hTotalB += lB;
            const lname = (l.name || l.lessonName || k || '').toLowerCase();
            if (lname.includes('mat')) {
              if (l.N !== undefined) hMathNet = Number(l.N);
              else if (l.net !== undefined) hMathNet = Number(l.net);
              else if (l.n !== undefined) hMathNet = Number(l.n);
              else hMathNet = (Number(l.D || l.correct || 0)) - (lY / 3);
            }
          });
        }

        historyExamsForStudent.push({
          name: exam.name,
          score,
          details: resolvedDetails,
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
                         badges: { kalkan: 0, ivme: 0, zirve: 0, tamIsabet: 0, kirmiziKart: 0, zirveBekcisi: 0, ivmeSampiyonu: 0, barajYikici: 0, stratejiMuhendisi: 0, istikrarElcisi: 0, lgsFatihi: 0, ankaKusu: 0, sozelSovalyesi: 0, sayisalKalesi: 0, matematikUyanisi: 0, dengeCambazi: 0, keskinNisanci: 0, temelAtici: 0, uyuyanDev: 0, sabirTasi: 0, yinYang: 0, filozof: 0, newton: 0, pisagor: 0 }
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
    
    if (currentTeam === 'Atanmadı') currentTeam = 'Taktik Avcıları';

    const hasAnyBadge = Object.values(badges).some(v => v > 0);
    const hasAnyMonthlyData = Object.keys(monthlyLeagueData).length > 0;

    return {
      ...student,
      leaguePoints: totalLP,
      leagueTeam: currentTeam,
      lastTransfer,
      transferHistory,
      pendingTransfer,
      badges: hasAnyBadge ? badges : (student.badges && Object.values(student.badges).some((v: any) => Number(v) > 0) ? student.badges : undefined),
      monthlyLeagueData: hasAnyMonthlyData ? monthlyLeagueData : (student.monthlyLeagueData && Object.keys(student.monthlyLeagueData).length > 0 ? student.monthlyLeagueData : undefined)
    };
  });
  
  return firstPass;
}

export { getStudentInfoFit, getStudentNameFontSize } from './studentTextFit';

export function compileMonthlyArenaSnapshots(
  students: any[],
  exams: any[],
  results: any[],
  mentors: Record<string, string> = {},
  teamBonus: Record<string, number> = {}
): Record<string, any> {
  const snapshots: Record<string, any> = {};

  const turkishMonthNames: Record<string, string> = {
    '01': 'Ocak', '02': 'Şubat', '03': 'Mart', '04': 'Nisan',
    '05': 'Mayıs', '06': 'Haziran', '07': 'Temmuz', '08': 'Ağustos',
    '09': 'Eylül', '10': 'Ekim', '11': 'Kasım', '12': 'Aralık'
  };

  // 1. Gather all month keys from exams
  const monthsMap = new Map<string, { exams: any[] }>();
  (exams || []).forEach(e => {
    if (e.date) {
      const d = parseDate(e.date);
      const mStr = String(d.getMonth() + 1).padStart(2, '0');
      const yStr = String(d.getFullYear());
      const monthKey = `${yStr}-${mStr}`;
      if (!monthsMap.has(monthKey)) {
        monthsMap.set(monthKey, { exams: [] });
      }
      monthsMap.get(monthKey)!.exams.push(e);
    }
  });

  monthsMap.forEach(({ exams: monthExams }, monthKey) => {
    const [yStr, mStr] = monthKey.split('-');
    const monthLabel = `${turkishMonthNames[mStr] || mStr} ${yStr}`;
    const examNames = monthExams.map(e => e.name);

    // Filter students who have points or participated in this month
    const studentEntries: any[] = [];
    const teamLPAccum: Record<string, { totalLP: number; count: number; badgesCount: number }> = {
      'Kutup Yıldızları': { totalLP: 0, count: 0, badgesCount: 0 },
      'Sıçrama Ustaları': { totalLP: 0, count: 0, badgesCount: 0 },
      'Taktik Avcıları': { totalLP: 0, count: 0, badgesCount: 0 }
    };

    (students || []).forEach(s => {
      const mData = s.monthlyLeagueData?.[monthKey];
      const monthlyLP = mData?.points || 0;
      const badges = mData?.badges || {};
      const team = s.leagueTeam || 'Taktik Avcıları';

      // Check if student participated in any exam this month
      const participated = monthExams.some(e => {
        const r = (results || []).find(res => res.studentNo === s.no && s.no !== 0);
        return r && r.scores && r.scores[e.name] !== undefined && r.scores[e.name] > 0;
      });

      if (participated || monthlyLP > 0) {
        studentEntries.push({
          studentNo: s.no,
          name: s.name,
          className: s.className || '',
          classStr: s.classStr || s.className || '',
          sectionStr: s.sectionStr || '',
          team,
          monthlyLP,
          badges
        });

        if (teamLPAccum[team]) {
          teamLPAccum[team].totalLP += monthlyLP;
          teamLPAccum[team].count += 1;
          let totalBadges = 0;
          for (const val of Object.values(badges || {})) {
            totalBadges += Number(val) || 0;
          }
          teamLPAccum[team].badgesCount = (teamLPAccum[team].badgesCount || 0) + totalBadges;
        }
      }
    });

    // Sort students by monthly LP descending
    studentEntries.sort((a, b) => b.monthlyLP - a.monthlyLP);
    studentEntries.forEach((s, idx) => {
      s.rank = idx + 1;
    });

    // Add bonus points to teams if any
    const teamStandings: Record<string, any> = {};
    Object.keys(teamLPAccum).forEach(team => {
      const bonus = teamBonus?.[team] || 0;
      const count = teamLPAccum[team].count;
      const totalLP = teamLPAccum[team].totalLP + bonus;
      teamStandings[team] = {
        totalLP,
        studentCount: count,
        averageLP: count > 0 ? Math.round((totalLP / count) * 10) / 10 : 0,
        badgesCount: teamLPAccum[team].badgesCount
      };
    });

    // Podium (Top 3)
    const podium = studentEntries.slice(0, 3).map((s, idx) => ({
      rank: idx + 1,
      studentNo: s.studentNo,
      name: s.name,
      team: s.team,
      monthlyLP: s.monthlyLP
    }));

    // MVP
    const mvp = studentEntries.length > 0 ? {
      studentNo: studentEntries[0].studentNo,
      name: studentEntries[0].name,
      team: studentEntries[0].team,
      monthlyLP: studentEntries[0].monthlyLP,
      reason: 'Ayın En Yüksek Lig Puanı (LP) Lideri'
    } : undefined;

    snapshots[monthKey] = {
      monthKey,
      monthLabel,
      examCount: monthExams.length,
      examNames,
      studentCount: studentEntries.length,
      teamStandings,
      podium,
      mvp,
      studentsSummary: studentEntries,
      updatedAt: new Date().toISOString()
    };
  });

  return snapshots;
}

