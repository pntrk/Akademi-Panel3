import { normalizeTurkish } from './omrEngine';

export interface LessonStat {
  name: string;
  correct: number;
  wrong: number;
  empty: number;
  net: number;
  accuracy: number;
}

export interface CoachingInsight {
  title: string;
  desc: string;
  icon: string;
  badge?: string;
  tag?: string;
}

export interface CoachingTactic {
  step: number;
  title: string;
  action: string;
  icon: string;
  targetLesson?: string;
}

export interface CoachingReport {
  studentName: string;
  studentNo?: number | string;
  className?: string;
  team: string;
  rank: number;
  totalStudents: number;
  leaguePoints: number;
  examName: string;
  examDate?: string;
  hasExamData: boolean;
  score: number;
  totalNet: number;
  totalCorrect: number;
  totalWrong: number;
  totalEmpty: number;
  trend: 'up' | 'down' | 'steady' | 'first';
  trendDifference: number;
  lessons: LessonStat[];
  recentBadges: string[];
  totalBadgeCount: number;
  strengths: CoachingInsight[];
  risks: CoachingInsight[];
  tactics: CoachingTactic[];
  coachSummary: string;
}

export function generateCoachingReport(
  student: any,
  allHistory: any[] = [],
  studentRank: number = 1,
  totalStudentsCount: number = 1
): CoachingReport {
  const studentName = student?.name || 'Öğrenci';
  const studentNo = student?.no;
  const className = student?.className || student?.studentClass || '';
  const team = student?.leagueTeam || 'Taktik Avcıları';
  const leaguePoints = (student?.displayPoints !== undefined ? student.displayPoints : student?.leaguePoints) || 0;
  const totalBadgeCount = student?.badges?.length || student?.displayBadges?.length || 0;

  // Öğrencinin son sınavını belirle
  const validHistory = Array.isArray(allHistory) ? allHistory.filter(h => h && (h.score > 0 || (h.details && Object.keys(h.details).length > 0))) : [];
  const lastExam = validHistory.length > 0 ? validHistory[validHistory.length - 1] : null;
  const prevExam = validHistory.length > 1 ? validHistory[validHistory.length - 2] : null;

  const hasExamData = Boolean(lastExam);
  const examName = lastExam?.name || 'Henüz Sınav Kaydı Yok';
  const examDate = lastExam?.date || '';
  const score = lastExam?.score || 0;

  // Ders isim ve takma adlarını MEB LGS standart derslerine eşleştir
  const resolveSubjectCanonical = (rawKey: string, valName?: string): { canonKey: string; displayName: string; order: number } | null => {
    const targetStr = (valName && valName.trim() ? valName : rawKey).trim();
    const clean = normalizeTurkish(targetStr).toLowerCase().replace(/[\s\.\-_/]+/g, '');
    if (!clean) return null;

    // Özet veya sistem alanlarını ders olarak kabul etme
    if (
      clean === 'toplam' || clean === 'genel' || clean === 'toplamnet' ||
      clean === 'net' || clean === 'puan' || clean === 'lgs' || clean === 'tyt' || clean === 'ayt' ||
      clean === 'score' || clean === 'average' || clean === 'total' || clean === 'id' || clean === 'date' ||
      clean === 'examid' || clean === 'sinav'
    ) {
      return null;
    }

    if (clean.includes('turk')) {
      return { canonKey: 'turkce', displayName: 'Türkçe', order: 1 };
    }
    if (clean.includes('ink') || clean.includes('tarih') || clean.includes('sosyal') || clean === 'tar' || clean === 'sb') {
      return { canonKey: 'inkilap', displayName: 'T.C. İnkılap Tarihi ve Atatürkçülük', order: 2 };
    }
    if (clean.includes('din') || clean.includes('dkab')) {
      return { canonKey: 'din', displayName: 'Din Kültürü ve Ahlak Bilgisi', order: 3 };
    }
    if (clean.includes('ing') || clean.includes('yabanci') || clean.includes('dil') || clean.includes('english')) {
      return { canonKey: 'ingilizce', displayName: 'İngilizce', order: 4 };
    }
    if (clean.includes('mat')) {
      return { canonKey: 'matematik', displayName: 'Matematik', order: 5 };
    }
    if (clean.includes('fen')) {
      return { canonKey: 'fen', displayName: 'Fen Bilimleri', order: 6 };
    }

    // Sayısal ID anahtarları (örn: 1..6) için standart MEB LGS branş sıralaması
    if (/^[1-6]$/.test(clean)) {
      const num = parseInt(clean, 10);
      switch (num) {
        case 1: return { canonKey: 'turkce', displayName: 'Türkçe', order: 1 };
        case 2: return { canonKey: 'inkilap', displayName: 'T.C. İnkılap Tarihi ve Atatürkçülük', order: 2 };
        case 3: return { canonKey: 'din', displayName: 'Din Kültürü ve Ahlak Bilgisi', order: 3 };
        case 4: return { canonKey: 'ingilizce', displayName: 'İngilizce', order: 4 };
        case 5: return { canonKey: 'matematik', displayName: 'Matematik', order: 5 };
        case 6: return { canonKey: 'fen', displayName: 'Fen Bilimleri', order: 6 };
      }
    }

    return { canonKey: clean, displayName: targetStr, order: 99 };
  };

  // Ders kırılımlarını çıkar ve mükerrer dersleri (örn: Türkçe ve 1) tekilleştir
  const canonicalMap = new Map<string, LessonStat & { order: number }>();
  const rawDetailsSource = lastExam?.details?.lessons 
    || lastExam?.details 
    || lastExam?.examRes?.evaluatedScore?.subjectScores 
    || lastExam?.examRes?.scores;

  if (rawDetailsSource && typeof rawDetailsSource === 'object') {
    Object.entries(rawDetailsSource).forEach(([key, val]: [string, any]) => {
      if (val === undefined || val === null) return;

      const valName = typeof val === 'object' ? (val.name || val.lessonName) : undefined;
      const meta = resolveSubjectCanonical(key, valName);
      if (!meta) return;

      let d = 0;
      let y = 0;
      let b = 0;
      let n = 0;

      if (typeof val === 'object') {
        d = Number(val.D ?? val.correct ?? 0) || 0;
        y = Number(val.Y ?? val.wrong ?? 0) || 0;
        b = Number(val.B ?? val.empty ?? 0) || 0;
        n = typeof val.N === 'number' 
          ? val.N 
          : (typeof val.net === 'number' 
              ? val.net 
              : (typeof val.n === 'number' ? val.n : (d - y / 3)));
      } else if (typeof val === 'number') {
        n = val;
        d = Math.round(val);
      } else if (typeof val === 'string' && !isNaN(parseFloat(val.replace(',', '.')))) {
        n = parseFloat(val.replace(',', '.'));
        d = Math.round(n);
      } else {
        return;
      }

      const cleanNet = Math.round(n * 100) / 100;
      const answered = d + y;
      const accuracy = answered > 0 ? Math.round((d / answered) * 100) : (cleanNet > 0 ? 100 : 0);

      const existing = canonicalMap.get(meta.canonKey);
      if (!existing) {
        canonicalMap.set(meta.canonKey, {
          name: meta.displayName,
          correct: d,
          wrong: y,
          empty: b,
          net: cleanNet,
          accuracy,
          order: meta.order
        });
      } else {
        // Mükerrer kayıt tespit edildiğinde (Örn: "Türkçe" ve subject ID "1")
        // Doğru/yanlış/boş verisi daha zengin olan kaydı tercih et
        const currentHasDetails = (existing.correct + existing.wrong + existing.empty) > 0;
        const newHasDetails = (d + y + b) > 0;
        if (!currentHasDetails && newHasDetails) {
          canonicalMap.set(meta.canonKey, {
            name: existing.name || meta.displayName,
            correct: d,
            wrong: y,
            empty: b,
            net: cleanNet,
            accuracy,
            order: existing.order
          });
        }
      }
    });
  }

  // MEB müfredat sırasına göre dizilmiş kesin tekil ders listesi
  const lessons: LessonStat[] = Array.from(canonicalMap.values())
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...rest }) => rest);

  let totalCorrect = lessons.reduce((sum, l) => sum + l.correct, 0);
  let totalWrong = lessons.reduce((sum, l) => sum + l.wrong, 0);
  let totalEmpty = lessons.reduce((sum, l) => sum + l.empty, 0);
  let totalNet = Math.round(lessons.reduce((sum, l) => sum + l.net, 0) * 100) / 100;

  // Yedek sınav skor doğrulamaları
  if (totalNet === 0 && lastExam?.net) {
    totalNet = Math.round(Number(lastExam.net) * 100) / 100;
  }
  if (totalCorrect === 0 && lastExam?.examRes?.totalCorrect) {
    totalCorrect = Number(lastExam.examRes.totalCorrect) || 0;
  }
  if (totalWrong === 0 && lastExam?.examRes?.totalWrong) {
    totalWrong = Number(lastExam.examRes.totalWrong) || 0;
  }

  const turkStat = canonicalMap.get('turkce') || null;
  const matStat = canonicalMap.get('matematik') || null;
  const fenStat = canonicalMap.get('fen') || null;
  const inkStat = canonicalMap.get('inkilap') || null;
  const dinStat = canonicalMap.get('din') || null;
  const ingStat = canonicalMap.get('ingilizce') || null;

  // Trend hesabı
  let trend: 'up' | 'down' | 'steady' | 'first' = 'first';
  let trendDifference = 0;
  if (prevExam) {
    const diff = score - prevExam.score;
    trendDifference = Math.round(Math.abs(diff) * 100) / 100;
    if (diff > 1.5) trend = 'up';
    else if (diff < -1.5) trend = 'down';
    else trend = 'steady';
  }

  // Son sınavda kazanılan rozetler
  const recentBadges: string[] = [];
  if (lastExam?.badgeCounts && typeof lastExam.badgeCounts === 'object') {
    Object.entries(lastExam.badgeCounts).forEach(([bKey, count]) => {
      if (Number(count) > 0) {
        recentBadges.push(bKey);
      }
    });
  }
  if (recentBadges.length === 0 && Array.isArray(student?.badges)) {
    recentBadges.push(...student.badges.slice(-3));
  }

  // ==========================================
  // PEDAGOJİK ANALİZ MOTORU: GÜÇLÜ YÖNLER
  // ==========================================
  const strengths: CoachingInsight[] = [];

  // 1. LGS Fatihi / Full Başarı
  if (totalCorrect > 0 && totalWrong === 0 && totalEmpty === 0) {
    strengths.push({
      title: 'Eksiksiz Şampiyonluk (90/90)',
      desc: 'Tüm soruları sıfır yanlış ve sıfır boş ile eksiksiz yanıtlayarak 500 tam puan barajını fethetti.',
      icon: '👑',
      tag: 'LGS Fatihi'
    });
  }

  // 2. Kalkan & Boş Bırakma Disiplini
  if (totalEmpty > totalWrong && totalEmpty > 0) {
    strengths.push({
      title: 'Kalkan Savunması (Net Koruma)',
      desc: `Şüpheli kalınan sorularda sallamak yerine ${totalEmpty} soru boş bırakılarak net kaybı başarıyla önlendi.`,
      icon: '🛡️',
      tag: 'Net Savunması'
    });
  }

  // 3. Sözel Şövalyesi (İnkılap, Din, İngilizce fire yok)
  const sozelWrong = (inkStat?.wrong || 0) + (dinStat?.wrong || 0) + (ingStat?.wrong || 0);
  const sozelCorrect = (inkStat?.correct || 0) + (dinStat?.correct || 0) + (ingStat?.correct || 0);
  if (sozelCorrect >= 20 && sozelWrong === 0) {
    strengths.push({
      title: 'Sözel Çelik Kalkanı',
      desc: 'İnkılap Tarihi, Din Kültürü ve Yabancı Dil testlerinde sıfır yanlış ile maksimum net katkısı sağlandı.',
      icon: '⚔️',
      tag: 'Sözel Şövalyesi'
    });
  }

  // 4. Matematik Motor Gücü
  if (matStat && matStat.net >= 14) {
    strengths.push({
      title: 'Matematik Lokomotifi',
      desc: `Matematikte ${matStat.net.toFixed(2)} net elde edilerek sınavın en belirleyici dersinde büyük avantaj yakalandı.`,
      icon: '📐',
      tag: 'Matematik Uyanışı'
    });
  } else if (matStat && matStat.net >= 9) {
    strengths.push({
      title: 'Matematikte Güçlü Temel',
      desc: `Matematikte ${matStat.net.toFixed(2)} net seviyesi yakalandı, yeni nesil soru çözme potansiyeli yüksek.`,
      icon: '📐',
      tag: 'Matematik'
    });
  }

  // 5. Fen Bilimleri Yüksek Doğruluk
  if (fenStat && fenStat.net >= 16) {
    strengths.push({
      title: 'Fen Bilimlerinde Üstün İsabet',
      desc: `Fen Bilimleri testinde ${fenStat.net.toFixed(2)} net ile deney ve grafik sorularında güçlü bir hakimiyet kuruldu.`,
      icon: '🔬',
      tag: 'Fen Başarısı'
    });
  }

  // 6. Türkçe Okuma ve Anlam Becerisi
  if (turkStat && turkStat.net >= 16) {
    strengths.push({
      title: 'Türkçe Paragraf ve Muhakeme Gücü',
      desc: `Türkçede ${turkStat.net.toFixed(2)} net ile uzun metinler ve sözel mantık sorularında yüksek konsantrasyon gösterildi.`,
      icon: '📖',
      tag: 'Türkçe'
    });
  }

  // 7. Pozitif Gelişim İvmesi
  if (trend === 'up') {
    strengths.push({
      title: 'Yükselen Gelişim İvmesi',
      desc: `Bir önceki deneme sınavına göre puanını +${trendDifference.toFixed(2)} puan artırarak pozitif ivme kazandı.`,
      icon: '🔥',
      tag: 'İvme'
    });
  }

  // Fallback Güçlü Yön
  if (strengths.length === 0) {
    strengths.push({
      title: 'Sınava Katılım ve Mücadele Ruhu',
      desc: 'Deneme sınavını tamamlayarak lig mücadelesinde takımına katkı sağladı; gelişim için sağlam bir zemin mevcut.',
      icon: '⭐',
      tag: 'Takım Ruhu'
    });
  }

  // ==========================================
  // PEDAGOJİK ANALİZ MOTORU: RİSKLİ ALANLAR
  // ==========================================
  const risks: CoachingInsight[] = [];

  // 1. Çok Fazla Yanlış (Sallama ve 3 Yanlış 1 Doğru Tehlikesi)
  if (totalWrong >= 12) {
    const lostNet = (totalWrong / 3).toFixed(2);
    risks.push({
      title: 'Yüksek Yanlış Sayısı (Net Aşınması)',
      desc: `Toplam ${totalWrong} yanlış cevap nedeniyle tam ${lostNet} net silindi. İki şık arasında kalınan sorularda işaretleme yapılmış olabilir.`,
      icon: '⚠️',
      tag: 'Sallama Riski'
    });
  }

  // 2. Matematik Aşırı Fire
  if (matStat && matStat.wrong >= 5) {
    risks.push({
      title: 'Matematikte İşlem ve Dikkat Hataları',
      desc: `Matematikte ${matStat.wrong} yanlış bulunuyor. Sayısal sorularda işlem adımlarını kenara yazma ve turlama taktiğine ihtiyaç var.`,
      icon: '📉',
      tag: 'Matematik Riski'
    });
  }

  // 3. Fen Bilimlerinde Kavram Yanılgısı
  if (fenStat && fenStat.wrong >= 4) {
    risks.push({
      title: 'Fen Bilimlerinde Soru Kökü Dikkatsizliği',
      desc: `Fen testindeki ${fenStat.wrong} yanlış, "kesinlikle/değinilmemiştir" gibi olumsuz köklere veya öncüllü grafik yorumlarına işaret ediyor.`,
      icon: '🔬',
      tag: 'Fen Riski'
    });
  }

  // 4. Sözel Küçük Branşlarda Gereksiz Kayıp
  if (sozelWrong >= 4) {
    risks.push({
      title: 'Ara Derslerde (İnkılap/Din/İng) Net Kaybı',
      desc: `10'ar soruluk yan branşlarda toplam ${sozelWrong} yanlış yapıldı. Bu dersler katsayıları küçük olsa da yüzdelik dilimi doğrudan etkiler.`,
      icon: '🎯',
      tag: 'Sözel Yangın'
    });
  }

  // 5. Boş Bırakmama Refleksi (0 Boş Ama Çok Yanlış)
  if (totalEmpty === 0 && totalWrong >= 8) {
    risks.push({
      title: 'Sıfır Boş Bırakma Refleksi',
      desc: 'Hiçbir sorunun boş bırakılmaması, emin olunmayan soruların sezgisel işaretlendiğini ve netlerin doğrudan düştüğünü gösteriyor.',
      icon: '🛑',
      tag: 'Boş Bırakma Eksikliği'
    });
  }

  // 6. Zaman Yönetimi ve Aşırı Boş (Süre Yetmeme)
  if (totalEmpty >= 12 && (matStat?.empty || 0) >= 6) {
    risks.push({
      title: 'Süre Yetiştirememe Sinyali',
      desc: `Sınavda ${totalEmpty} soru boş kaldı (özellikle matematikte ${matStat?.empty} boş). Takılınan sorularda fazla zaman harcanmış olabilir.`,
      icon: '⏱️',
      tag: 'Zaman Yönetimi'
    });
  }

  // Fallback Risk
  if (risks.length === 0) {
    risks.push({
      title: 'Dikkat ve Konsantrasyon Devamlılığı',
      desc: 'Mevcut net dengesini korumak için sınavın son 20 dakikasındaki optik kodlama ve zihin yorgunluğuna dikkat edilmeli.',
      icon: '💡',
      tag: 'Konsantrasyon'
    });
  }

  // ==========================================
  // PEDAGOJİK ANALİZ MOTORU: 3 MADDELİK TAKTİK REÇETESİ
  // ==========================================
  const tactics: CoachingTactic[] = [];

  // Taktik 1: Sınav Stratejisi & Turlama
  if (totalWrong >= 8 || (matStat && matStat.empty >= 4)) {
    tactics.push({
      step: 1,
      title: 'Turlama Tekniği & 1 Dakika Kuralı',
      action: 'Bir soruyu okuduktan sonra 45 saniye içinde çözüm yolu belirmediyse yanına küçük bir sembol koyup hemen sonraki soruya geç. Sınavın sonunda kalan vakitte geri dön. Bu taktik tek başına en az +3 net kazandıracaktır.',
      icon: '⏱️'
    });
  } else {
    tactics.push({
      step: 1,
      title: 'İlk 5 Soru Isınma ve Ritim Yönetimi',
      action: 'Sınava en rahat hissettiğin dersten başla. İlk 5 soruda acele etmeden soru köklerinin altını çizerek ritim yakala ve optik forma kodlamayı sayfa sayfa kontrol ederek yap.',
      icon: '🎯'
    });
  }

  // Taktik 2: En Çok Net Kazandıracak Odak Ders
  if (matStat && matStat.net < 13 && matStat.wrong >= 3) {
    const targetNet = Math.min(20, Math.ceil(matStat.net + 3));
    tactics.push({
      step: 2,
      title: `Matematikte Hedef: ${targetNet} Net`,
      action: `Şu anki ${matStat.net.toFixed(2)} neti ${targetNet}'e taşımak için: Deneme öncesi cebirsel ifadeler ve çarpanlar konularından 2 test hız sorusu çöz. Denemede en az 2 soruyu emin olmadan işaretlemeyip boş bırak.`,
      icon: '📐',
      targetLesson: 'Matematik'
    });
  } else if (fenStat && fenStat.net < 16 && fenStat.wrong >= 3) {
    const targetNet = Math.min(20, Math.ceil(fenStat.net + 3));
    tactics.push({
      step: 2,
      title: `Fen Bilimlerinde Hedef: ${targetNet} Net`,
      action: `Mevcut ${fenStat.net.toFixed(2)} neti ${targetNet}'e yükseltmek için: Deney düzenekli sorularda bağımsız değişken ve kontrol edilen değişkeni sorunun yanına not et. Şıkları eleyerek ilerle.`,
      icon: '🔬',
      targetLesson: 'Fen Bilimleri'
    });
  } else if (sozelWrong >= 3) {
    tactics.push({
      step: 2,
      title: 'Sözel Branşlarda Sıfır Fire Hedefi',
      action: 'Din Kültürü, İnkılap ve İngilizce sınavlarında her soruda paragrafın kendi sınırları içinde kal. Kendi yorumunu katmadan doğrudan metinde geçen anahtar kelimeyi ara.',
      icon: '⚔️',
      targetLesson: 'Sözel'
    });
  } else {
    const currentTurkNet = turkStat?.net || 15;
    const targetTurkNet = Math.min(20, Math.ceil(currentTurkNet + 2));
    tactics.push({
      step: 2,
      title: `Türkçede Hedef: ${targetTurkNet} Net`,
      action: `Türkçede ${currentTurkNet.toFixed(2)} olan netini ${targetTurkNet}'e çıkarmak için sözel mantık sorularında mutlaka küçük bir tablo veya şema çizerek eleme yap.`,
      icon: '📖',
      targetLesson: 'Türkçe'
    });
  }

  // Taktik 3: Rozet Hedefi & Psikolojik Eşik
  if (totalWrong > totalEmpty && totalWrong >= 6) {
    tactics.push({
      step: 3,
      title: 'Rozet Hedefi: "Kalkan" Rozetini Kazan (+20 LP)',
      action: 'Bir sonraki deneme sınavında iki şık arasında kalıp emin olamadığın en az 3 soruyu bilinçli olarak boş bırak. Boş sayın yanlış sayını geçtiğinde hem netin yükselir hem de Kalkan rozeti kazanırsın.',
      icon: '🛡️'
    });
  } else if (sozelWrong <= 2 && sozelWrong > 0) {
    tactics.push({
      step: 3,
      title: 'Rozet Hedefi: "Sözel Şövalyesi" (+10 LP)',
      action: 'İnkılap, Din ve İngilizce branşlarında 0 yanlışı yakalayarak Sözel Şövalyesi rozetini kilidini aç ve takımına puan kazandır.',
      icon: '⚔️'
    });
  } else if (matStat && matStat.net >= 10 && matStat.net < 15) {
    tactics.push({
      step: 3,
      title: 'Rozet Hedefi: "Pisagor" & "Sayısal Kalesi" (+12 LP)',
      action: 'Matematik ve Fende toplam yanlış sayısını 2\'nin altında tutarak Sayısal Kalesi rozetini takım hanene yazdır.',
      icon: '🏰'
    });
  } else {
    tactics.push({
      step: 3,
      title: 'Rozet Hedefi: "Tam İsabet" (+10 LP)',
      action: 'En güvendiğin derste 0 yanlış yaparak Tam İsabet rozetini garantile ve lig sıralamasında sıçrama yap.',
      icon: '🎯'
    });
  }

  // Koçun Kapanış Özeti
  let coachSummary = `${studentName}, ${team} takımında #${studentRank} sırada mücadele ediyor. `;
  if (score >= 450) {
    coachSummary += 'Genel sınav performansı üst düzey nitelikli okullar bandında. Eksiksiz soru okuma ve turlama taktiğiyle 500 tam puana ulaşabilecek potansiyele sahip.';
  } else if (score >= 380) {
    coachSummary += 'Başarılı bir puan eşiğinde. Sayısal derslerdeki yanlış sayısını azaltıp 2-3 soruda boş bırakma disiplini gösterdiğinde sıralamada ciddi bir sıçrama yapacaktır.';
  } else if (score >= 300) {
    coachSummary += 'Gelişime çok açık bir grafik çiziyor. Sözel dersleri kayıpsız geçip matematikte bildiği sorulara odaklandığında puanını hızla 380+ bandına taşıyabilir.';
  } else {
    coachSummary += 'Düzenli konu tekrarları ve denemede acele etmeden soru köklerini iyi analiz etme stratejisiyle puanını belirgin şekilde yükseltebilir.';
  }

  return {
    studentName,
    studentNo,
    className,
    team,
    rank: studentRank,
    totalStudents: totalStudentsCount,
    leaguePoints,
    examName,
    examDate,
    hasExamData,
    score: Math.round(score * 100) / 100,
    totalNet: Math.round(totalNet * 100) / 100,
    totalCorrect,
    totalWrong,
    totalEmpty,
    trend,
    trendDifference,
    lessons,
    recentBadges,
    totalBadgeCount,
    strengths,
    risks,
    tactics,
    coachSummary
  };
}
