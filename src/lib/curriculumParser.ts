import * as XLSX from 'xlsx';
import { QuestionOutcomeItem } from '../types';
import { normalizeTurkishText, getOutcomesBySubject, findOutcomeByCode, matchOutcomeByText } from './curriculumData';

export interface ParsedCurriculumResult {
  success: boolean;
  examTitle?: string;
  gradeLevel?: string;
  totalQuestions: number;
  outcomes: QuestionOutcomeItem[];
  keys: {
    A: string[];
    B?: string[];
  };
  subjects: { name: string; count: number; offset: number }[];
  error?: string;
}

/**
 * MEB LGS Standart Ders Sıralaması ve Soru Dağılımı:
 * 1. Türkçe: 20 soru (1..20)
 * 2. T.C. İnkılap Tarihi: 10 soru (21..30)
 * 3. Din Kültürü: 10 soru (31..40)
 * 4. İngilizce: 10 soru (41..50)
 * 5. Matematik: 20 soru (51..70)
 * 6. Fen Bilimleri: 20 soru (71..90)
 */
export const MEB_LGS_SUBJECT_OFFSETS: Record<string, { offset: number; count: number; canonicalName: string }> = {
  'Türkçe': { offset: 0, count: 20, canonicalName: 'Türkçe' },
  'T.C. İnkılap Tarihi': { offset: 20, count: 10, canonicalName: 'T.C. İnkılap Tarihi' },
  'Din Kültürü': { offset: 30, count: 10, canonicalName: 'Din Kültürü' },
  'İngilizce': { offset: 40, count: 10, canonicalName: 'İngilizce' },
  'Matematik': { offset: 50, count: 20, canonicalName: 'Matematik' },
  'Fen Bilimleri': { offset: 70, count: 20, canonicalName: 'Fen Bilimleri' }
};

/**
 * Yayıncı ders adlarını standart MEB LGS branş adlarına çevirir
 */
export function normalizeSubjectName(raw: string): string {
  const clean = normalizeTurkishText(raw).replace(/[\s\.\-_/()]+/g, '');
  // Din Kültürü önce kontrol edilir (çünkü "dinkulturu" içinde "ink" harfleri bulunur)
  if (clean.includes('din') || clean.includes('dkab') || clean.includes('ahlak')) return 'Din Kültürü';
  // İnkılap / Tarih
  if (clean.includes('tar') || clean.includes('ink') || clean.includes('sos') || clean.includes('ataturk')) return 'T.C. İnkılap Tarihi';
  // Türkçe ("tur" hem "turkce" hem de "sozeltur" için eşleşir)
  if (clean.includes('tur')) return 'Türkçe';
  // Matematik
  if (clean.includes('mat')) return 'Matematik';
  // Fen Bilimleri
  if (clean.includes('fen')) return 'Fen Bilimleri';
  // İngilizce
  if (clean.includes('ing') || clean.includes('dil') || clean.includes('english')) return 'İngilizce';
  return String(raw || '').trim() || 'Genel';
}

/**
 * Ham kod ve açıklamadan standart MEB kazanım kodu ve açıklamasını çıkarır/eşleştirir
 */
export function extractOutcomeDetails(
  rawCode: string | undefined,
  rawDesc: string | undefined,
  subject: string,
  localQNum: number
): { code: string; desc: string; topic: string } {
  let code = String(rawCode || '').trim();
  let desc = String(rawDesc || '').trim();
  let topic = subject;

  // 1. Çoklu kod içeren durumlarda (örn: Ankara Yayıncılık "8.7.1.1,8.7.1.2") ilk birincil kodu al
  if (code.includes(',')) {
    code = code.split(',')[0].trim();
  } else if (code.includes(';')) {
    code = code.split(';')[0].trim();
  }

  // 2. Kod boşsa ama açıklama MEB koduyla başlıyorsa (örn: Bilfen Din "8.1.5. Hz. Musa...", İngilizce "E8.1.SP1. Students...")
  if (!code && desc) {
    const codeMatch = desc.match(/^(E?8(?:\.[0-9A-Za-z]+)+)\.?\s*(.*)/i);
    if (codeMatch) {
      code = codeMatch[1].trim();
      desc = codeMatch[2].trim() || desc;
    }
  }

  // 3. Mevcut kod kataloğumuzda var mı kontrol et
  if (code) {
    const catalogItem = findOutcomeByCode(code);
    if (catalogItem) {
      topic = catalogItem.topic || topic;
      if (!desc || desc.length < 5) {
        desc = catalogItem.description;
      }
    }
  }

  // 4. Kod bulunamadıysa metin/konu üzerinden resmi MEB kataloğuyla akıllı eşleme yap
  if (!code && desc) {
    const matched = matchOutcomeByText(subject, desc);
    if (matched) {
      code = matched.code;
      topic = matched.topic || topic;
      if (!desc || desc.length < 5) {
        desc = matched.description;
      }
    }
  }

  // 5. Standart formatta kod üret (Geri dönüş fallback)
  if (!code) {
    const subPrefix = subject === 'Türkçe' ? '8.TUR'
      : subject === 'Matematik' ? '8.MAT'
      : subject === 'Fen Bilimleri' ? '8.FEN'
      : subject === 'T.C. İnkılap Tarihi' ? '8.INK'
      : subject === 'Din Kültürü' ? '8.DIN'
      : '8.ING';
    code = `${subPrefix}.${localQNum}`;
  }

  if (!desc) {
    desc = `${subject} Soru ${localQNum} Kazanımı`;
  }

  return { code, desc, topic };
}

/**
 * Yayıncı XML SpreadsheetML veya standart .xlsx/.xls dosyalarından
 * Soru no, A/B kitapçık karşılığı, Doğru Cevap, MEB Kazanım Kodu ve Açıklamasını okur.
 * Bilfen, Çanta, İşleyen Zeka, Ankara, Mozaik ve tüm standart LGS şablonlarını destekler.
 */
export function parseCurriculumSpreadsheet(fileContent: string | ArrayBuffer): ParsedCurriculumResult {
  try {
    let workbook: XLSX.WorkBook;

    if (typeof fileContent === 'string') {
      workbook = XLSX.read(fileContent, { type: 'string' });
    } else {
      const data = new Uint8Array(fileContent);
      workbook = XLSX.read(data, { type: 'array' });
    }

    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { success: false, totalQuestions: 0, outcomes: [], keys: { A: [] }, subjects: [], error: 'Tablo sayfası bulunamadı.' };
    }

    // Bilfen şablonunda 'ŞABLON' sayfası veya ilk geçerli sayfa
    const sheetName = workbook.SheetNames.includes('ŞABLON') ? 'ŞABLON' : workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!rawRows || rawRows.length < 3) {
      return { success: false, totalQuestions: 0, outcomes: [], keys: { A: [] }, subjects: [], error: 'Tabloda yeterli veri satırı yok.' };
    }

    let examTitle = '';
    let gradeLevel = '8. Sınıf';

    // Sınav Başlığı Tespiti
    const headerCandidates = rawRows.slice(0, 4).flat().map(c => String(c).trim()).filter(Boolean);
    for (const text of headerCandidates) {
      if (text.includes('TG') || text.includes('SINIF') || text.includes('Süreç') || text.includes('DENEME') || text.includes('SDS') || text.includes('MOZAİK') || text.includes('BİLFEN') || text.includes('ÇANTA') || text.includes('İŞLEYEN') || text.includes('ANKARA')) {
        if (!examTitle) examTitle = text;
      }
      if (text.includes('8.Sınıf') || text.includes('8. Sınıf') || text.includes('8. SINIF')) {
        gradeLevel = '8. Sınıf';
      }
    }

    // Şablon formatını tespit et:
    // Format B: Bilfen / Özdebir Blok Şablonu (satır satır ders başlıkları ve alt ders sütunları)
    const isBlockFormat = rawRows.some(r => {
      const rStr = r.map(c => normalizeTurkishText(String(c))).join(' ');
      return rStr.includes('kitapcigi') || rStr.includes('alt ders') || rStr.includes('kazanim id');
    });

    const subjectItems: Record<string, { localQ: number; keyA?: string; altB?: number; code: string; desc: string; topic: string }[]> = {};

    if (isBlockFormat) {
      // ==================== BİLFEN / BLOK ŞABLON AYRIŞTIRICI ====================
      let currentSubject = 'Türkçe';

      for (let r = 0; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const col0 = String(row[0] || '').trim();
        const col1 = String(row[1] || '').trim();
        const col2 = String(row[2] || '').trim();
        const col5 = String(row[5] || '').trim();
        const col7 = String(row[7] || '').trim();
        const col8 = String(row[8] || '').trim();
        const col9 = String(row[9] || '').trim();

        const joinedRow = row.slice(0, 10).map(c => normalizeTurkishText(String(c))).join(' ');

        // Yeni ders geçiş satırı mı?
        if (joinedRow.includes('kitapcigi') || (isNaN(Number(col0)) && col5 && normalizeTurkishText(col5).includes('ders'))) {
          const detectedSub = normalizeSubjectName(col0 || col5);
          if (detectedSub !== 'Genel') {
            currentSubject = detectedSub;
          }
          continue;
        }

        // Soru veri satırı mı? (Soru No 1..20 ve Cevap A..D)
        const qNum = Number(col0);
        if (!isNaN(qNum) && qNum > 0 && col1.length === 1 && /[A-D]/i.test(col1)) {
          if (!subjectItems[currentSubject]) subjectItems[currentSubject] = [];
          const altQ = Number(col2);
          const outcomeInfo = extractOutcomeDetails(col7, col9 || col8, currentSubject, qNum);

          subjectItems[currentSubject].push({
            localQ: qNum,
            keyA: col1.toUpperCase(),
            altB: !isNaN(altQ) && altQ > 0 ? altQ : undefined,
            code: outcomeInfo.code,
            desc: outcomeInfo.desc,
            topic: outcomeInfo.topic
          });
        }
      }
    } else {
      // ==================== STANDART ÇANTA / ANKARA / İŞLEYEN ZEKA / MOZAİK AYRIŞTIRICI ====================
      let headerRowIdx = -1;
      let colMap: Record<string, number> = { booklet: 0, test: 1, ders: 2, aSoru: 3, bSoru: 4, cevap: 5, kod: 6, aciklama: 7 };

      for (let r = 0; r < Math.min(10, rawRows.length); r++) {
        const row = rawRows[r].map(c => normalizeTurkishText(String(c)));
        const hasDers = row.some(c => c.includes('ders') || c.includes('test'));
        const hasSoru = row.some(c => c.includes('soru'));
        const hasKazanim = row.some(c => c.includes('kazanim') || c.includes('kod'));

        if (hasDers && (hasSoru || hasKazanim)) {
          headerRowIdx = r;
          row.forEach((col, idx) => {
            if (col.includes('kitap')) colMap.booklet = idx;
            else if (col === 'ders') colMap.ders = idx;
            else if (col.includes('test')) colMap.test = idx;
            else if (col.includes('a') && col.includes('soru')) colMap.aSoru = idx;
            else if (col.includes('b') && col.includes('soru')) colMap.bSoru = idx;
            else if (col.includes('soru') && colMap.aSoru === undefined) colMap.aSoru = idx;
            else if (col.includes('cevap') || col === 'c' || col === 'ans') colMap.cevap = idx;
            else if (col.includes('kazanim kodu') || col.includes('kod')) colMap.kod = idx;
            else if (col.includes('kazanim') || col.includes('aciklama') || col.includes('konu')) {
              if (colMap.aciklama === undefined) colMap.aciklama = idx;
            }
          });
          break;
        }
      }

      if (headerRowIdx === -1) headerRowIdx = 2;

      let currentSubject = 'Türkçe';

      for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
        const row = rawRows[r];
        if (!row || row.length === 0) continue;

        const dersRaw = String(row[colMap.ders ?? 2] || row[colMap.test ?? 1] || '').trim();
        if (dersRaw && normalizeTurkishText(dersRaw) !== 'toplam') {
          currentSubject = normalizeSubjectName(dersRaw);
        }

        const aSoruVal = Number(row[colMap.aSoru ?? 3]);
        const bSoruVal = Number(row[colMap.bSoru ?? 4]);
        const cevapVal = String(row[colMap.cevap ?? 5] || '').trim().toUpperCase();
        const kodVal = String(row[colMap.kod ?? 6] || '').trim();
        const aciklamaVal = String(row[colMap.aciklama ?? 7] || '').trim();

        if (!isNaN(aSoruVal) && aSoruVal > 0) {
          if (!subjectItems[currentSubject]) subjectItems[currentSubject] = [];
          const outcomeInfo = extractOutcomeDetails(kodVal, aciklamaVal, currentSubject, aSoruVal);

          subjectItems[currentSubject].push({
            localQ: aSoruVal,
            keyA: cevapVal || undefined,
            altB: !isNaN(bSoruVal) && bSoruVal > 0 ? bSoruVal : undefined,
            code: outcomeInfo.code,
            desc: outcomeInfo.desc,
            topic: outcomeInfo.topic
          });
        }
      }
    }

    // 90 soruluk standart LGS akışında küresel (global) soru indeksi ata
    const orderedSubjects = ['Türkçe', 'T.C. İnkılap Tarihi', 'Din Kültürü', 'İngilizce', 'Matematik', 'Fen Bilimleri'];
    let runningGlobalIndex = 0;
    const subjectsMeta: { name: string; count: number; offset: number }[] = [];
    const outcomes: QuestionOutcomeItem[] = [];
    const keyMapA: Record<number, string> = {};
    const keyMapB: Record<number, string> = {};

    // Önce standart 6 dersi, sonra varsa diğer dersleri işle
    const allDetectedSubjects = Array.from(new Set([...orderedSubjects, ...Object.keys(subjectItems)]));

    for (const subName of allDetectedSubjects) {
      const items = subjectItems[subName];
      if (!items || items.length === 0) continue;

      const offset = runningGlobalIndex;
      subjectsMeta.push({ name: subName, count: items.length, offset });

      // Ders içi soru sırasına göre sırala
      items.sort((a, b) => a.localQ - b.localQ);

      items.forEach((item, localIdx) => {
        const globalIndex = runningGlobalIndex + localIdx + 1;
        const globalAltIndex = item.altB ? runningGlobalIndex + item.altB : undefined;

        outcomes.push({
          id: item.code ? `${item.code}_${globalIndex}` : `q-${globalIndex}`,
          questionNumber: globalIndex,
          subjectQuestionNumber: localIdx + 1,
          subjectName: subName,
          code: item.code,
          title: item.desc || item.code || `Soru ${globalIndex}`,
          topic: item.topic,
          correctAnswer: item.keyA || undefined,
          qIndex: globalIndex,
          altQIndex: globalAltIndex,
          outcomeCode: item.code,
          outcomeDesc: item.desc,
          subject: subName
        });

        if (item.keyA) {
          keyMapA[globalIndex] = item.keyA;
        }
        if (globalAltIndex && item.keyA) {
          keyMapB[globalAltIndex] = item.keyA;
        }
      });

      runningGlobalIndex += items.length;
    }

    if (outcomes.length === 0) {
      return { success: false, totalQuestions: 0, outcomes: [], keys: { A: [] }, subjects: [], error: 'Tablodan soru veya kazanım çıkarılamadı.' };
    }

    const totalCount = outcomes.length;
    const keysA: string[] = [];
    for (let i = 1; i <= totalCount; i++) {
      keysA.push(keyMapA[i] || '');
    }

    const hasB = Object.keys(keyMapB).length > 0;
    const keysB: string[] = [];
    if (hasB) {
      for (let i = 1; i <= totalCount; i++) {
        keysB.push(keyMapB[i] || '');
      }
    }

    return {
      success: true,
      examTitle: examTitle || 'Deneme Sınavı',
      gradeLevel,
      totalQuestions: totalCount,
      outcomes,
      keys: {
        A: keysA,
        ...(hasB ? { B: keysB } : {})
      },
      subjects: subjectsMeta
    };
  } catch (err: any) {
    console.error('Curriculum parse error:', err);
    return {
      success: false,
      totalQuestions: 0,
      outcomes: [],
      keys: { A: [] },
      subjects: [],
      error: err?.message || 'Dosya çözümlenirken beklenmeyen bir hata oluştu.'
    };
  }
}

