import * as XLSX from 'xlsx';
import { normalizeTurkish } from './omrEngine';
import { ALL_BADGE_DEFINITIONS, BADGE_POINTS } from './badgeDefinitions';

export interface ParsedBadgeInfo {
  totalCount: number;
  totalLP: number;
  summaryText: string;
  badgeCounts: Record<string, number>;
  badgeItems: Array<{ label: string; count: number; lp: number }>;
}

// Canonical badge mapping list
export const CANONICAL_BADGES: Array<{ key: string; label: string; defaultLP: number }> = [
  { key: 'lgsFatihi', label: 'LGS Fatihi', defaultLP: 30 },
  { key: 'ankaKusu', label: 'Anka Kuşu', defaultLP: 25 },
  { key: 'zirveBekcisi', label: 'Zirve Bekçisi', defaultLP: 20 },
  { key: 'ivmeSampiyonu', label: 'İvme Şampiyonu', defaultLP: 15 },
  { key: 'barajYikici', label: 'Baraj Yıkıcı', defaultLP: 12 },
  { key: 'stratejiMuhendisi', label: 'Strateji Mühendisi', defaultLP: 10 },
  { key: 'istikrarElcisi', label: 'İstikrar Elçisi', defaultLP: 15 },
  { key: 'sozelSovalyesi', label: 'Sözel Şövalyesi', defaultLP: 10 },
  { key: 'sayisalKalesi', label: 'Sayısal Kalesi', defaultLP: 12 },
  { key: 'matematikUyanisi', label: 'Matematik Uyanışı', defaultLP: 8 },
  { key: 'dengeCambazi', label: 'Denge Cambazı', defaultLP: 8 },
  { key: 'keskinNisanci', label: 'Keskin Nişancı', defaultLP: 6 },
  { key: 'temelAtici', label: 'Temel Atıcı', defaultLP: 5 },
  { key: 'filozof', label: 'Filozof', defaultLP: 8 },
  { key: 'newton', label: 'Newton', defaultLP: 10 },
  { key: 'pisagor', label: 'Pisagor', defaultLP: 10 },
  { key: 'uyuyanDev', label: 'Uyuyan Dev', defaultLP: 10 },
  { key: 'sabirTasi', label: 'Sabır Taşı', defaultLP: 5 },
  { key: 'yinYang', label: 'Yin Yang', defaultLP: 8 },
  { key: 'kalkan', label: 'Kalkan', defaultLP: 5 },
  { key: 'zirve', label: 'Zirve', defaultLP: 15 },
  { key: 'ivme', label: 'İvme', defaultLP: 8 },
  { key: 'tamIsabet', label: 'Tam İsabet', defaultLP: 10 },
  { key: 'kirmiziKart', label: 'Kırmızı Kart', defaultLP: -10 },
  { key: 'takimRuhu', label: 'Takım Ruhu', defaultLP: 8 }
];

export function mapRawBadgeKey(rawKey: string): { key: string; label: string; lp: number } | null {
  if (!rawKey) return null;
  const k = normalizeTurkish(String(rawKey)).toLowerCase().replace(/[\s\.\-_]+/g, '');
  if (k.includes('lgsfatih')) return { key: 'lgsFatihi', label: 'LGS Fatihi', lp: BADGE_POINTS.lgsFatihi || 30 };
  if (k.includes('ankakus')) return { key: 'ankaKusu', label: 'Anka Kuşu', lp: BADGE_POINTS.ankaKusu || 25 };
  if (k.includes('zirvebekcisi')) return { key: 'zirveBekcisi', label: 'Zirve Bekçisi', lp: BADGE_POINTS.zirveBekcisi || 20 };
  if (k.includes('ivmesampiyonu')) return { key: 'ivmeSampiyonu', label: 'İvme Şampiyonu', lp: BADGE_POINTS.ivmeSampiyonu || 15 };
  if (k.includes('barajyikici')) return { key: 'barajYikici', label: 'Baraj Yıkıcı', lp: BADGE_POINTS.barajYikici || 12 };
  if (k.includes('stratejimuhendisi') || k.includes('stratejimh')) return { key: 'stratejiMuhendisi', label: 'Strateji Mühendisi', lp: BADGE_POINTS.stratejiMuhendisi || 10 };
  if (k.includes('istikrarelcisi')) return { key: 'istikrarElcisi', label: 'İstikrar Elçisi', lp: BADGE_POINTS.istikrarElcisi || 15 };
  if (k.includes('sozelsovalye')) return { key: 'sozelSovalyesi', label: 'Sözel Şövalyesi', lp: BADGE_POINTS.sozelSovalyesi || 10 };
  if (k.includes('sayisalkale')) return { key: 'sayisalKalesi', label: 'Sayısal Kalesi', lp: BADGE_POINTS.sayisalKalesi || 12 };
  if (k.includes('matematikuyanis') || k.includes('matuyanis')) return { key: 'matematikUyanisi', label: 'Matematik Uyanışı', lp: BADGE_POINTS.matematikUyanisi || 8 };
  if (k.includes('dengecambaz')) return { key: 'dengeCambazi', label: 'Denge Cambazı', lp: BADGE_POINTS.dengeCambazi || 8 };
  if (k.includes('keskinnisan')) return { key: 'keskinNisanci', label: 'Keskin Nişancı', lp: BADGE_POINTS.keskinNisanci || 6 };
  if (k.includes('temelatici')) return { key: 'temelAtici', label: 'Temel Atıcı', lp: BADGE_POINTS.temelAtici || 5 };
  if (k.includes('filozof')) return { key: 'filozof', label: 'Filozof', lp: BADGE_POINTS.filozof || 8 };
  if (k.includes('newton')) return { key: 'newton', label: 'Newton', lp: BADGE_POINTS.newton || 10 };
  if (k.includes('pisagor')) return { key: 'pisagor', label: 'Pisagor', lp: BADGE_POINTS.pisagor || 10 };
  if (k.includes('uyuyandev')) return { key: 'uyuyanDev', label: 'Uyuyan Dev', lp: BADGE_POINTS.uyuyanDev || 10 };
  if (k.includes('sabirtasi')) return { key: 'sabirTasi', label: 'Sabır Taşı', lp: BADGE_POINTS.sabirTasi || 5 };
  if (k.includes('yinyang')) return { key: 'yinYang', label: 'Yin Yang', lp: BADGE_POINTS.yinYang || 8 };
  if (k.includes('kalkan')) return { key: 'kalkan', label: 'Kalkan', lp: BADGE_POINTS.kalkan || 5 };
  if (k.includes('zirve')) return { key: 'zirve', label: 'Zirve', lp: BADGE_POINTS.zirve || 15 };
  if (k.includes('ivme')) return { key: 'ivme', label: 'İvme', lp: BADGE_POINTS.ivme || 8 };
  if (k.includes('tamisabet')) return { key: 'tamIsabet', label: 'Tam İsabet', lp: BADGE_POINTS.tamIsabet || 10 };
  if (k.includes('kirmizikart')) return { key: 'kirmiziKart', label: 'Kırmızı Kart', lp: BADGE_POINTS.kirmiziKart || -10 };
  if (k.includes('takimruhu')) return { key: 'takimRuhu', label: 'Takım Ruhu', lp: BADGE_POINTS.takimRuhu || 8 };
  return null;
}

export function parseStudentBadges(rawBadges: any): ParsedBadgeInfo {
  const badgeCounts: Record<string, number> = {};
  const customBadges: Array<{ label: string; count: number; lp: number }> = [];

  if (Array.isArray(rawBadges)) {
    rawBadges.forEach(item => {
      if (!item) return;
      const name = typeof item === 'string' ? item : (item.name || item.label || '');
      const count = typeof item === 'object' && item.count ? Number(item.count) || 1 : 1;
      const mapped = mapRawBadgeKey(name);
      if (mapped) {
        badgeCounts[mapped.key] = (badgeCounts[mapped.key] || 0) + count;
      } else if (name) {
        customBadges.push({ label: String(name), count, lp: 5 });
      }
    });
  } else if (rawBadges && typeof rawBadges === 'object') {
    Object.entries(rawBadges).forEach(([key, val]) => {
      const count = typeof val === 'number' ? val : (Number(val) || 0);
      if (count <= 0) return;
      const mapped = mapRawBadgeKey(key);
      if (mapped) {
        badgeCounts[mapped.key] = (badgeCounts[mapped.key] || 0) + count;
      } else if (key) {
        customBadges.push({ label: key, count, lp: 5 });
      }
    });
  }

  const badgeItems: Array<{ label: string; count: number; lp: number }> = [];
  let totalCount = 0;
  let totalLP = 0;

  CANONICAL_BADGES.forEach(b => {
    const count = badgeCounts[b.key] || 0;
    if (count > 0) {
      badgeItems.push({ label: b.label, count, lp: b.defaultLP });
      totalCount += count;
      totalLP += count * b.defaultLP;
    }
  });

  customBadges.forEach(cb => {
    badgeItems.push(cb);
    totalCount += cb.count;
    totalLP += cb.count * cb.lp;
  });

  const summaryText = badgeItems.length > 0 
    ? badgeItems.map(b => `${b.label} (${b.count})`).join(', ')
    : '-';

  return {
    totalCount,
    totalLP,
    summaryText,
    badgeCounts,
    badgeItems
  };
}

function formatStudentRecordToRow(s: any, rank: number, periodLabel: string) {
  const badges = parseStudentBadges(s.displayBadges || s.allBadges || s.badges);
  const studentLP = s.displayPoints !== undefined ? s.displayPoints : (s.leaguePoints || 0);

  const row: Record<string, any> = {
    'Sıra': rank,
    'Okul No': s.no || '-',
    'Öğrenci Adı Soyadı': s.name || '-',
    'Sınıf / Şube': s.className || s.studentClass || '-',
    'Takım': s.leagueTeam || 'Takım Atanmadı',
    'Dönem': periodLabel,
    'LP Skoru': studentLP,
    'Sınav Sayısı': s.examCount || 0,
    'Toplam Rozet Sayısı': badges.totalCount,
    'Rozet LP Puanı': badges.totalLP,
    'Kazanılan Rozetler (Özet)': badges.summaryText
  };

  // Add individual badge columns for easy filtering / pivoting
  CANONICAL_BADGES.forEach(b => {
    row[b.label] = badges.badgeCounts[b.key] || 0;
  });

  return row;
}

function generateCSV(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const csvLines: string[] = [];

  // Header line
  csvLines.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(';'));

  // Data lines
  rows.forEach(r => {
    const line = headers.map(h => {
      const val = r[h] !== undefined && r[h] !== null ? r[h] : '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(';');
    csvLines.push(line);
  });

  return '\uFEFF' + csvLines.join('\r\n');
}

function downloadFile(content: BlobPart, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Build Badge Catalog sheet
function createBadgeGuideSheet() {
  const guideData = ALL_BADGE_DEFINITIONS.map((b, idx) => ({
    'Sıra': idx + 1,
    'Rozet Adı': b.label,
    'Kategori': b.categoryLabel || '-',
    'LP Değeri': b.lp,
    'Takım Kısıtlaması': b.teamRestriction || 'Tüm Takımlar',
    'Kazanım Şartı': b.condition || '-',
    'Detaylı Açıklama': b.description || '-'
  }));
  const ws = XLSX.utils.json_to_sheet(guideData);
  ws['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 18 },
    { wch: 12 },
    { wch: 20 },
    { wch: 45 },
    { wch: 55 }
  ];
  return ws;
}

// Build Team Summary Stats sheet
function createTeamStatsSheet(students: any[], mentors?: Record<string, string>) {
  const teams = ['Kutup Yıldızları', 'Sıçrama Ustaları', 'Taktik Avcıları'];
  
  const statsRows = teams.map(teamName => {
    const teamStudents = students.filter(s => s.leagueTeam === teamName);
    const count = teamStudents.length;
    const totalLP = teamStudents.reduce((sum, s) => sum + (s.displayPoints !== undefined ? s.displayPoints : (s.leaguePoints || 0)), 0);
    const avgLP = count > 0 ? Math.round(totalLP / count) : 0;
    
    // Badges count in team
    let teamTotalBadges = 0;
    const badgeFreq: Record<string, number> = {};
    
    teamStudents.forEach(s => {
      const bInfo = parseStudentBadges(s.displayBadges || s.allBadges || s.badges);
      teamTotalBadges += bInfo.totalCount;
      Object.entries(bInfo.badgeCounts).forEach(([k, c]) => {
        badgeFreq[k] = (badgeFreq[k] || 0) + c;
      });
    });

    let topBadgeName = '-';
    let topBadgeCount = 0;
    Object.entries(badgeFreq).forEach(([k, c]) => {
      if (c > topBadgeCount) {
        topBadgeCount = c;
        const found = CANONICAL_BADGES.find(b => b.key === k);
        topBadgeName = found ? `${found.label} (${c})` : `${k} (${c})`;
      }
    });

    // Team star
    const sorted = [...teamStudents].sort((a, b) => (b.displayPoints || 0) - (a.displayPoints || 0));
    const starName = sorted[0] && (sorted[0].displayPoints || 0) > 0 ? `${sorted[0].name} (${sorted[0].displayPoints} LP)` : 'Henüz Yok';

    return {
      'Takım': teamName,
      'Koç / Mentör': mentors?.[teamName] || '-',
      'Üye Sayısı': count,
      'Ortalama LP': avgLP,
      'Toplam Takım LP': totalLP,
      'Toplam Kazanılan Rozet': teamTotalBadges,
      'En Çok Kazanılan Rozet': topBadgeName,
      'Takım Yıldızı (1. Öğrenci)': starName
    };
  });

  const ws = XLSX.utils.json_to_sheet(statsRows);
  ws['!cols'] = [
    { wch: 20 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
    { wch: 22 },
    { wch: 28 },
    { wch: 30 }
  ];
  return ws;
}

/**
 * Export a single team's member roster and earned badges to Excel (.xlsx) or CSV
 */
export function exportTeamToExcel(
  teamName: string,
  allStudents: any[],
  periodLabel: string,
  format: 'xlsx' | 'csv' = 'xlsx',
  mentors?: Record<string, string>
) {
  const teamStudents = allStudents
    .filter(s => s.leagueTeam === teamName)
    .sort((a, b) => (b.displayPoints || 0) - (a.displayPoints || 0));

  const rows = teamStudents.map((s, idx) => formatStudentRecordToRow(s, idx + 1, periodLabel));

  const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  const cleanTeam = normalizeTurkish(teamName).replace(/\s+/g, '_');
  const cleanPeriod = normalizeTurkish(periodLabel).replace(/\s+/g, '_');
  const filename = `Akademi_Arena_${cleanTeam}_Kadro_ve_Rozetler_${cleanPeriod}_${dateStr}`;

  if (format === 'csv') {
    const csv = generateCSV(rows);
    downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
    return;
  }

  // XLSX Workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: Team Members
  const wsTeam = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Bilgi': 'Bu takımda henüz kayıtlı öğrenci bulunmuyor.' }]);
  const colWidths = [
    { wch: 6 },
    { wch: 12 },
    { wch: 26 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 45 },
    ...CANONICAL_BADGES.map(() => ({ wch: 15 }))
  ];
  wsTeam['!cols'] = colWidths;

  const safeSheetName = cleanTeam.slice(0, 31);
  XLSX.utils.book_append_sheet(wb, wsTeam, safeSheetName);

  // Sheet 2: Rozet Dağılımı ve Takım İstatistikleri
  const badgeStatsRows = CANONICAL_BADGES.map(b => {
    let earnedCount = 0;
    let studentCount = 0;
    teamStudents.forEach(s => {
      const bInfo = parseStudentBadges(s.displayBadges || s.allBadges || s.badges);
      const c = bInfo.badgeCounts[b.key] || 0;
      if (c > 0) {
        earnedCount += c;
        studentCount += 1;
      }
    });

    return {
      'Rozet Adı': b.label,
      'LP Değeri': b.defaultLP,
      'Takımdaki Toplam Adet': earnedCount,
      'Rozeti Kazanan Öğrenci Sayısı': studentCount,
      'Takıma Getirdiği Toplam LP': earnedCount * b.defaultLP
    };
  }).filter(r => r['Takımdaki Toplam Adet'] > 0);

  const wsBadgeStats = XLSX.utils.json_to_sheet(
    badgeStatsRows.length > 0 
      ? badgeStatsRows 
      : [{ 'Bilgi': 'Bu takımda henüz kazanılmış rozet bulunmuyor.' }]
  );
  wsBadgeStats['!cols'] = [
    { wch: 22 },
    { wch: 12 },
    { wch: 22 },
    { wch: 28 },
    { wch: 25 }
  ];
  XLSX.utils.book_append_sheet(wb, wsBadgeStats, 'Rozet_Dagilimi');

  // Sheet 3: Rozet Rehberi
  const wsGuide = createBadgeGuideSheet();
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Rozet_Rehberi');

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export all teams or filtered roster with member lists and badge breakdowns
 */
export function exportAllTeamsToExcel(
  allStudents: any[],
  periodLabel: string,
  format: 'xlsx' | 'csv' = 'xlsx',
  mentors?: Record<string, string>
) {
  const sortedStudents = [...allStudents].sort((a, b) => (b.displayPoints || 0) - (a.displayPoints || 0));
  const rows = sortedStudents.map((s, idx) => formatStudentRecordToRow(s, idx + 1, periodLabel));

  const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
  const cleanPeriod = normalizeTurkish(periodLabel).replace(/\s+/g, '_');
  const filename = `Akademi_Arena_Tum_Takimlar_Kadro_ve_Rozetler_${cleanPeriod}_${dateStr}`;

  if (format === 'csv') {
    const csv = generateCSV(rows);
    downloadFile(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
    return;
  }

  // XLSX Workbook
  const wb = XLSX.utils.book_new();

  // Sheet 1: Tüm Arena Kadrosu
  const wsAll = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Bilgi': 'Kayıtlı öğrenci bulunmuyor.' }]);
  const colWidths = [
    { wch: 6 },
    { wch: 12 },
    { wch: 26 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 45 },
    ...CANONICAL_BADGES.map(() => ({ wch: 15 }))
  ];
  wsAll['!cols'] = colWidths;
  XLSX.utils.book_append_sheet(wb, wsAll, 'Tum_Arena_Kadro');

  // Individual Team Sheets
  const teams = [
    { name: 'Kutup Yıldızları', sheet: 'Kutup_Yildizlari' },
    { name: 'Sıçrama Ustaları', sheet: 'Sicrama_Ustalari' },
    { name: 'Taktik Avcıları', sheet: 'Taktik_Avcilari' }
  ];

  teams.forEach(t => {
    const tStudents = sortedStudents.filter(s => s.leagueTeam === t.name);
    const tRows = tStudents.map((s, idx) => formatStudentRecordToRow(s, idx + 1, periodLabel));
    const wsT = XLSX.utils.json_to_sheet(tRows.length > 0 ? tRows : [{ 'Bilgi': `${t.name} kadrosunda öğrenci bulunmuyor.` }]);
    wsT['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, wsT, t.sheet);
  });

  // Sheet 5: Takım İstatistikleri & Özet
  const wsStats = createTeamStatsSheet(sortedStudents, mentors);
  XLSX.utils.book_append_sheet(wb, wsStats, 'Takim_Istatistikleri');

  // Sheet 6: Rozet Rehberi
  const wsGuide = createBadgeGuideSheet();
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Rozet_Rehberi');

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
