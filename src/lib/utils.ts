import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import * as XLSX from "xlsx";
import { normalizeTurkish } from './omrEngine';
import { BADGE_POINTS } from './badgeDefinitions';
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
 * Metin veya sınav adından tarih çıkartır (Örn: "LGS - 24 Ekim 2026", "Deneme (24.10.2026)" -> "24.10.2026")
 */
export function extractDateFromText(text: string | null | undefined): string | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  // Standard DD.MM.YYYY, DD/MM/YYYY veya DD-MM-YYYY
  const dmMatch = trimmed.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})\b/);
  if (dmMatch) {
    const day = dmMatch[1].padStart(2, '0');
    const month = dmMatch[2].padStart(2, '0');
    let year = dmMatch[3];
    if (year.length === 2) year = '20' + year;
    return `${day}.${month}.${year}`;
  }
  // Doğal Türkçe tarih (Örn: "24 Ekim 2026")
  const d = parseDateObj(trimmed);
  if (d) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  }
  return null;
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
  const earnedBadges: string[] = [];
  const badgeCounts = { 
    kalkan: 0, ivme: 0, zirve: 0, tamIsabet: 0, kirmiziKart: 0, 
    zirveBekcisi: 0, ivmeSampiyonu: 0, barajYikici: 0, stratejiMuhendisi: 0, istikrarElcisi: 0, 
    lgsFatihi: 0, ankaKusu: 0, sozelSovalyesi: 0, sayisalKalesi: 0, matematikUyanisi: 0, 
    dengeCambazi: 0, keskinNisanci: 0, temelAtici: 0, uyuyanDev: 0, sabirTasi: 0, 
    yinYang: 0, filozof: 0, newton: 0, pisagor: 0, takimRuhu: 0 
  };
  
  let totalD = 0;
  let totalY = 0;
  let totalB = 0;
  let mathNet = 0;

  let inkY = 0, dinY = 0, ingY = 0;
  let inkD = 0, dinD = 0, ingD = 0;
  let matD = 0, matY = 0, fenD = 0, fenY = 0, turkD = 0, turkY = 0;
  let matN = 0, turkN = 0, fenN = 0, inkN = 0, dinN = 0, ingN = 0;
  let allNetNonNegative = true;
  let hasAtLeastOneBranchTamIsabet = false;

  if (lessonsDetails && typeof lessonsDetails === 'object') {
    Object.entries(lessonsDetails).forEach(([k, lesson]: [string, any]) => {
      if (!lesson || typeof lesson !== 'object') return;
      const name = normalizeForSearch(lesson.name || lesson.lessonName || k || '');
      const lD = lesson.D !== undefined ? Number(lesson.D) : (lesson.correct !== undefined ? Number(lesson.correct) : 0);
      const lY = lesson.Y !== undefined ? Number(lesson.Y) : (lesson.wrong !== undefined ? Number(lesson.wrong) : 0);
      const lB = lesson.B !== undefined ? Number(lesson.B) : (lesson.empty !== undefined ? Number(lesson.empty) : 0);
      let lN = lesson.N !== undefined ? Number(lesson.N) : (lesson.net !== undefined ? Number(lesson.net) : (lesson.n !== undefined ? Number(lesson.n) : (lD - lY / 3)));
      
      if (lN < 0) allNetNonNegative = false;
      
      if (name.includes('ink') || name.includes('tarih') || name.includes('sosyal')) { inkY += lY; inkN = lN; inkD += lD; }
      if (name.includes('din') || name.includes('dkab')) { dinY += lY; dinN = lN; dinD += lD; }
      if (name.includes('ing') || name.includes('yabanci') || name.includes('dil')) { ingY += lY; ingD += lD; ingN = lN; }
      if (name.includes('mat')) { matD = lD; matY += lY; matN = lN; }
      if (name.includes('fen')) { fenD = lD; fenY += lY; fenN = lN; }
      if (name.includes('tur')) { turkD = lD; turkY = lY; turkN = lN; }

      totalD += lD;
      totalY += lY;
      totalB += lB;
      
      // Tam İsabet: Herhangi bir branşta 0 yanlış ve en az 1 doğru yapmak
      if (lY === 0 && lD > 0) {
        hasAtLeastOneBranchTamIsabet = true;
      }

      if (name.includes('mat')) {
        if (lesson.N !== undefined) mathNet = Number(lesson.N);
        else if (lesson.net !== undefined) mathNet = Number(lesson.net);
        else if (lesson.n !== undefined) mathNet = Number(lesson.n);
        else mathNet = lD - (lY / 3);
      }
    });
  }

  // 1. Kırmızı Kart (-10 LP)
  // Resmi Kural: "Sınavda yanlış sayısı doğru sayısından fazla olmak"
  // Sadece toplam yanlış doğru sayısından kesinlikle fazlaysa verilir (Kutup Yıldızları kısıtı kaldırıldı)
  const hasKirmiziKart = (totalD + totalY) > 0 && totalY > totalD;
  if (hasKirmiziKart) {
    badgeCounts.kirmiziKart = 1;
    earnedBadges.push('Kırmızı Kart');
  }

  // 2. Kalkan (+5 LP)
  // Resmi Kural: "Boş sayısı yanlış sayısından fazla olmak (Boş > Yanlış)"
  const hasKalkan = totalB > totalY && totalB > 0 && !hasKirmiziKart;
  if (hasKalkan) {
    badgeCounts.kalkan = 1;
    earnedBadges.push('Kalkan');
  }

  // 3. LGS Fatihi (+30 LP)
  // Resmi Kural: "Denemede tüm soruları 0 yanlış ve 0 boş ile bitirmek"
  const isLgsFatihi = totalD > 0 && totalY === 0 && totalB === 0;
  if (isLgsFatihi) {
    badgeCounts.lgsFatihi = 1;
    earnedBadges.push('LGS Fatihi');
  }

  // 4. Tam İsabet (+10 LP)
  // Resmi Kural: "Herhangi bir branşta 0 yanlış ve en az 1 doğru yapmak"
  if (hasAtLeastOneBranchTamIsabet && !isLgsFatihi) {
    badgeCounts.tamIsabet = 1;
    earnedBadges.push('Tam İsabet');
  }

  // --- Takım Bazlı Rozetler ---
  if (team === 'Kutup Yıldızları') {
    // Sözel Şövalyesi (+10 LP): Türkçe, Din, İnkılap ve İngilizce branşlarında 0 yanlış yapmak
    if (turkY === 0 && dinY === 0 && inkY === 0 && ingY === 0 && (turkD + dinD + inkD + ingD) > 0) {
      badgeCounts.sozelSovalyesi = 1;
      earnedBadges.push('Sözel Şövalyesi');
    }
    // Sayısal Kalesi (+12 LP): Matematik ve Fen derslerinde en fazla 2 yanlış yapmak
    if (matY + fenY <= 2 && (matD + fenD) > 0) {
      badgeCounts.sayisalKalesi = 1;
      earnedBadges.push('Sayısal Kalesi');
    }
  } else if (team === 'Sıçrama Ustaları') {
    // Matematik Uyanışı (+8 LP): Matematik branşında 10 ve üzeri nete ulaşmak
    if (matN >= 10) {
      badgeCounts.matematikUyanisi = 1;
      earnedBadges.push('Matematik Uyanışı');
    }
    // Denge Cambazı (+8 LP): Türkçe ve Fen derslerinde 15+ net dengesini kurmak
    if (turkN >= 15 && fenN >= 15) {
      badgeCounts.dengeCambazi = 1;
      earnedBadges.push('Denge Cambazı');
    }
  } else if (team === 'Taktik Avcıları') {
    // Keskin Nişancı (+6 LP): İşaretlenen sorularda %70 ve üzeri isabet oranına ulaşmak
    if (totalD + totalY > 0 && (totalD / (totalD + totalY)) >= 0.70) {
      badgeCounts.keskinNisanci = 1;
      earnedBadges.push('Keskin Nişancı');
    }
    // Temel Atıcı (+5 LP): Hiçbir derste eksi nete düşmeden tüm dersleri pozitif bitirmek
    if (allNetNonNegative && totalD > 0) {
      badgeCounts.temelAtici = 1;
      earnedBadges.push('Temel Atıcı');
    }
  }

  // Zirve (+15 LP): Denemede 400 ve üzeri LGS puanı elde etmek
  if (examScore >= 400) {
    badgeCounts.zirve = 1;
    earnedBadges.push('Zirve');
  }

  // İvme (+8 LP): Önceki ortalamasına göre puanını artırmak
  if (previousAverage > 0 && examScore > previousAverage) {
    badgeCounts.ivme = 1;
    earnedBadges.push('İvme');
  }

  // --- Sınav Geçmişi İncelemesi (İstikrar ve Seri Rozetleri) ---
  const hasZirve = examScore >= 400;
  const currentExamFormatted = { score: examScore, hasKalkan, hasKirmiziKart, mathNet, hasZirve };
  const fullHistory = [...historyExams.map(h => {
    let hTotalD = 0; let hTotalY = 0; let hTotalB = 0; let hMathNet = 0;
    if (h.details) {
      Object.values(h.details).forEach((l: any) => {
        hTotalD += l.D || l.correct || 0;
        hTotalY += l.Y || l.wrong || 0;
        hTotalB += l.B || l.empty || 0;
        const name = (l.name || l.lessonName || '').toLowerCase();
        if (name.includes('mat')) {
          if (l.N !== undefined) hMathNet = l.N;
          else if (l.net !== undefined) hMathNet = l.net;
          else if (l.n !== undefined) hMathNet = l.n;
          else hMathNet = (l.D || 0) - ((l.Y || 0) / 3);
        }
      });
    }
    const hKirmizi = (hTotalD + hTotalY) > 0 && hTotalY > hTotalD;
    return { 
      score: h.score, 
      hasKalkan: hTotalB > hTotalY && hTotalB > 0 && !hKirmizi, 
      hasKirmiziKart: hKirmizi,
      hasZirve: h.score >= 400,
      totalY: hTotalY,
      mathNet: hMathNet
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

  // Zirve Bekçisi (+20 LP): Üst üste 3 denemede 400+ puan barajını korumak
  const zirveStreak = getStreak(h => h.hasZirve);
  if (zirveStreak > 0 && zirveStreak % 3 === 0) {
    badgeCounts.zirveBekcisi = 1;
    earnedBadges.push('Zirve Bekçisi');
  }

  // İvme Şampiyonu (+15 LP): Üst üste 3 denemede puanını artırmak
  const ivmeStreak = getStreak((h, i, arr) => {
    if (i === 0) return false;
    return h.score > arr[i - 1].score;
  });
  if (ivmeStreak > 0 && ivmeStreak % 3 === 0) {
    badgeCounts.ivmeSampiyonu = 1;
    earnedBadges.push('İvme Şampiyonu');
  }

  // Baraj Yıkıcı (+12 LP): Üst üste 3 denemede Matematik Neti >= 10
  const barajStreak = getStreak(h => h.mathNet >= 10);
  if (barajStreak > 0 && barajStreak % 3 === 0) {
    badgeCounts.barajYikici = 1;
    earnedBadges.push('Baraj Yıkıcı');
  }

  // Strateji Mühendisi (+10 LP): Üst üste 3 denemede Kalkan kazanmak
  const stratejiStreak = getStreak(h => h.hasKalkan);
  if (stratejiStreak > 0 && stratejiStreak % 3 === 0) {
    badgeCounts.stratejiMuhendisi = 1;
    earnedBadges.push('Strateji Mühendisi');
  }

  // İstikrar Elçisi (+15 LP): Üst üste 3 denemede Kırmızı Kart almamak ve gerilememek
  const istikrarStreak = getStreak((h, i, arr) => {
    if (h.hasKirmiziKart) return false;
    if (i === 0) return true;
    return h.score >= arr[i - 1].score - 10;
  });
  if (istikrarStreak >= 3 && istikrarStreak % 3 === 0) {
    badgeCounts.istikrarElcisi = 1;
    earnedBadges.push('İstikrar Elçisi');
  }

  // --- Yeni Gizemli ve Branş Rozetleri ---

  // Uyuyan Dev (+10 LP): Önceki ortalamaya göre +30 puan üzeri artış
  if (previousAverage > 0 && (examScore - previousAverage) >= 30) {
    badgeCounts.uyuyanDev = 1;
    earnedBadges.push('Uyuyan Dev');
  }

  // Sabır Taşı (+5 LP): Boş >= 10 ve 0 Yanlış ile sınavı tamamlamak
  if (totalB >= 10 && totalY === 0 && totalD > 0) {
    badgeCounts.sabirTasi = 1;
    earnedBadges.push('Sabır Taşı');
  }

  // Yin Yang (+8 LP): Sözel ve sayısal net dengesi (fark <= 2 ve her ikisi de > 0)
  const sozelNet = turkN + inkN + dinN + ingN;
  const sayisalNet = matN + fenN;
  if (sozelNet > 0 && sayisalNet > 0 && Math.abs(sozelNet - sayisalNet) <= 2) {
    badgeCounts.yinYang = 1;
    earnedBadges.push('Yin Yang');
  }

  // Filozof (+8 LP): Türkçe 20/20 tam doğru
  if (turkD >= 20 && turkY === 0) {
    badgeCounts.filozof = 1;
    earnedBadges.push('Filozof');
  }

  // Newton (+10 LP): Fen 20/20 tam doğru
  if (fenD >= 20 && fenY === 0) {
    badgeCounts.newton = 1;
    earnedBadges.push('Newton');
  }

  // Pisagor (+10 LP): Matematik 20/20 tam doğru
  if (matD >= 20 && matY === 0) {
    badgeCounts.pisagor = 1;
    earnedBadges.push('Pisagor');
  }

  // --- KAZANILAN LP HESAPLAMASI (STRICT BADGE POINTS) ---
  // Kazanılan lig puanı (LP), kazanılan rozetlerin getirdiği puanların birebir toplamıdır.
  let earnedLP = 0;
  Object.entries(badgeCounts).forEach(([k, count]: [string, any]) => {
    if (typeof count === 'number' && count > 0) {
      const pts = BADGE_POINTS[k] !== undefined ? BADGE_POINTS[k] : 0;
      earnedLP += pts * count;
    }
  });
  if (earnedLP < 0) earnedLP = 0;

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
      // 1. Sınavın kendi altındaki results listesinde öğrenciyi ara (Son yüklenen geçerli kabul edilir - Tekilleştirme)
      const matchingExamResults = (exam.results || []).filter((r: any) => {
        const rNo = r.no !== undefined ? Number(r.no) : (r.studentNo !== undefined ? Number(r.studentNo) : undefined);
        if (sNo > 0 && rNo !== undefined && rNo === sNo) return true;
        if (student.id && r.studentId && String(r.studentId) === String(student.id)) return true;
        if (sNameNorm && r.name && normalizeTurkish(r.name).trim().toLowerCase() === sNameNorm) return true;
        if (sNameNorm && r.studentName && normalizeTurkish(r.studentName).trim().toLowerCase() === sNameNorm) return true;
        return false;
      });
      const examRes = matchingExamResults.length > 0 ? matchingExamResults[matchingExamResults.length - 1] : undefined;

      // 2. Global sonuç listesinde skor kontrolü (Çakışma korumalı: ID öncelikli, isim çakışmasında tarih kontrolü)
      let scoreInGlobal: number | undefined = undefined;
      if (globalResult?.scores) {
        const rawScoreId = globalResult.scores[String(exam.id)];
        if (rawScoreId !== undefined) {
          scoreInGlobal = typeof rawScoreId === 'number' ? rawScoreId : (rawScoreId?.net ?? rawScoreId?.score);
        } else if (exam.name && globalResult.scores[exam.name] !== undefined) {
          // Eğer aynı ada sahip birden çok sınav varsa (örn. 24.10.2026 ve 20.03.2027 tarihlerindeki denemeler):
          // Gelecekteki veya farklı tarihteki sınavın skoru çalmasını engelle
          const sameNameExams = sortedExams.filter(se => se.name === exam.name);
          if (sameNameExams.length === 1) {
            const rawScoreName = globalResult.scores[exam.name];
            scoreInGlobal = typeof rawScoreName === 'number' ? rawScoreName : (rawScoreName?.net ?? rawScoreName?.score);
          } else {
            // Sadece öğrencinin bu sınavın results listesinde bulunması veya sınav tarihi ile sonuç tarihinin uyuşması durumunda al
            const hasInResults = Boolean(examRes);
            const dateMatches = exam.date && (globalResult.date === exam.date || (globalResult as any).examDate === exam.date);
            if (hasInResults || dateMatches) {
              const rawScoreName = globalResult.scores[exam.name];
              scoreInGlobal = typeof rawScoreName === 'number' ? rawScoreName : (rawScoreName?.net ?? rawScoreName?.score);
            }
          }
        }
      }

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

        let badgeLP = 0;
        Object.entries(badgeCounts).forEach(([k, count]: [string, any]) => {
          if (typeof count === 'number' && count > 0) {
            badgeLP += (BADGE_POINTS[k] !== undefined ? BADGE_POINTS[k] : 0) * count;
          }
        });

        // Kazanılan LP, sınavdaki rozetlerin standart puanlarının toplamıdır
        let earnedLP = Math.max(0, badgeLP);
        
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
            hasKirmiziKart: (hTotalY > 0 && hTotalY > (hTotalB + 10)),
            mathNet: hMathNet,
            hasZirve: score >= 400
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
                     const ankaPts = BADGE_POINTS.ankaKusu || 25;
                     totalLP += ankaPts;
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
                     monthlyLeagueData[tMonthKey].points += ankaPts;
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
      leagueTeam: count > 0 ? currentTeam : (student.leagueTeam || 'Taktik Avcıları'),
      lastTransfer: count > 0 ? lastTransfer : '',
      transferHistory: count > 0 ? transferHistory : (student.transferHistory || []),
      pendingTransfer: count > 0 ? pendingTransfer : null,
      badges: hasAnyBadge ? badges : undefined,
      monthlyLeagueData: hasAnyMonthlyData ? monthlyLeagueData : undefined
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

