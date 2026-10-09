export interface BadgeDefinition {
  key: string;
  label: string;
  shortLabel?: string;
  icon: string;
  lp: number; // Positive bonus or negative penalty (e.g., +200, -15)
  category: 'legendary' | 'streak' | 'team' | 'subject' | 'mystery' | 'core';
  categoryLabel: string;
  teamRestriction?: 'Kutup Yıldızları' | 'Sıçrama Ustaları' | 'Taktik Avcıları' | null;
  condition: string;
  description: string;
  bg: string;
  text: string;
  border: string;
}

export const BADGE_CATEGORIES: { id: BadgeDefinition['category'] | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'Tüm Rozetler (25)', icon: '🏅' },
  { id: 'legendary', label: 'Efsanevi (2)', icon: '🏆' },
  { id: 'streak', label: 'Seri & İstikrar (5)', icon: '⚡' },
  { id: 'team', label: 'Takım Özel (6)', icon: '⚔️' },
  { id: 'subject', label: 'Branş Ustaları (3)', icon: '📚' },
  { id: 'mystery', label: 'Gizemli Rozetler (3)', icon: '🦁' },
  { id: 'core', label: 'Temel Koruma (6)', icon: '🛡️' },
];

export const ALL_BADGE_DEFINITIONS: BadgeDefinition[] = [
  // 1. Efsanevi Rozetler
  {
    key: 'lgsFatihi',
    label: 'LGS Fatihi',
    icon: '🏆',
    lp: 200,
    category: 'legendary',
    categoryLabel: 'Efsanevi Rozetler',
    condition: '500 Tam Puan (0 Yanlış, 0 Boş)',
    description: 'Sınavdaki tüm 90 soruyu eksiksiz doğru cevaplayarak 0 yanlış ve 0 boş ile tam puan (500) alan öğrenciye verilir.',
    bg: 'bg-amber-500',
    text: 'text-white font-extrabold',
    border: 'border-amber-400'
  },
  {
    key: 'ankaKusu',
    label: 'Anka Kuşu',
    icon: '🔥',
    lp: 60,
    category: 'legendary',
    categoryLabel: 'Efsanevi Rozetler',
    condition: 'Küllerinden Doğuş (Büyük Yükseliş)',
    description: 'Taktik Avcıları takımından Sıçrama Ustaları veya Kutup Yıldızları takımına transfer başarısı gösteren öğrencilere verilir (+100 transfer LP bonusu içerir).',
    bg: 'bg-gradient-to-r from-orange-500 to-amber-500',
    text: 'text-white font-extrabold',
    border: 'border-orange-400'
  },

  // 2. Seri ve İstikrar Rozetleri
  {
    key: 'zirveBekcisi',
    label: 'Zirve Bekçisi',
    icon: '🏰',
    lp: 30,
    category: 'streak',
    categoryLabel: 'Seri & İstikrar',
    condition: '3 Sınav Üst Üste 400+ Puan',
    description: 'Kutup Yıldızları veya üst ligde kesintisiz 3 sınav boyunca 400 puan ve üzerinde kalarak zirveyi koruyan öğrenciye verilir.',
    bg: 'bg-fuchsia-100',
    text: 'text-fuchsia-900 font-bold',
    border: 'border-fuchsia-200'
  },
  {
    key: 'ivmeSampiyonu',
    label: 'İvme Şampiyonu',
    icon: '⚡',
    lp: 30,
    category: 'streak',
    categoryLabel: 'Seri & İstikrar',
    condition: '3 Sınav Üst Üste +5 Puan Artış',
    description: 'Kesintisiz 3 sınav boyunca her bir sınavda puanını bir önceki sınava kıyasla en az 5 puan artıran istikrarlı gelişim gösteren öğrenciye verilir.',
    bg: 'bg-cyan-100',
    text: 'text-cyan-900 font-bold',
    border: 'border-cyan-200'
  },
  {
    key: 'barajYikici',
    label: 'Baraj Yıkıcı',
    icon: '🔨',
    lp: 30,
    category: 'streak',
    categoryLabel: 'Seri & İstikrar',
    condition: '3 Sınav Üst Üste Matematik Neti ≥ 10',
    description: 'Matematik dersinde kesintisiz 3 deneme boyunca 10 net barajını aşarak zorlu soru psikolojisini kıran öğrenciye verilir.',
    bg: 'bg-orange-100',
    text: 'text-orange-900 font-bold',
    border: 'border-orange-200'
  },
  {
    key: 'stratejiMuhendisi',
    label: 'Strateji Mühendisi',
    icon: '🧠',
    lp: 40,
    category: 'streak',
    categoryLabel: 'Seri & İstikrar',
    condition: '4 Sınav Üst Üste Kalkan Rozeti',
    description: 'Üst üste 4 deneme sınavında bilmediği soruları sallamayıp boş bırakarak yanlış sayısını boş sayısının altında tutan taktik uzmanı öğrenciye verilir.',
    bg: 'bg-indigo-100',
    text: 'text-indigo-900 font-bold',
    border: 'border-indigo-200'
  },
  {
    key: 'istikrarElcisi',
    label: 'İstikrar Elçisi',
    icon: '🕊️',
    lp: 50,
    category: 'streak',
    categoryLabel: 'Seri & İstikrar',
    condition: '5 Sınav Kesintisiz Ceza Almadan Devam',
    description: '5 sınav boyunca hiç Kırmızı Kart görmeden kontrollü ve disiplinli sınav performansı sergileyen öğrenciye verilir.',
    bg: 'bg-teal-100',
    text: 'text-teal-900 font-bold',
    border: 'border-teal-200'
  },

  // 3. Takım Özel Rozetleri
  {
    key: 'sozelSovalyesi',
    label: 'Sözel Şövalyesi',
    icon: '📜',
    lp: 15,
    category: 'team',
    categoryLabel: 'Takım Özel Rozetleri',
    teamRestriction: 'Kutup Yıldızları',
    condition: 'İnkılap, Din ve İngilizce 0 Yanlış',
    description: 'Kutup Yıldızları takımında yer alan ve sınavda 3 ara sözel branşın (İnkılap, Din, İngilizce) tamamını sıfır yanlışla tamamlayan öğrenciye verilir.',
    bg: 'bg-amber-100',
    text: 'text-amber-900 font-bold',
    border: 'border-amber-200'
  },
  {
    key: 'sayisalKalesi',
    label: 'Sayısal Kalesi',
    icon: '🏰',
    lp: 20,
    category: 'team',
    categoryLabel: 'Takım Özel Rozetleri',
    teamRestriction: 'Kutup Yıldızları',
    condition: 'Matematik + Fen Toplam Yanlış ≤ 2',
    description: 'Kutup Yıldızları takımında sayısal oturumda Matematik ve Fen Bilimleri toplamında en fazla 2 yanlış yaparak sayısal kalesini savunan öğrenciye verilir.',
    bg: 'bg-amber-100',
    text: 'text-amber-900 font-bold',
    border: 'border-amber-200'
  },
  {
    key: 'matematikUyanisi',
    label: 'Matematik Uyanışı',
    icon: '💡',
    lp: 20,
    category: 'team',
    categoryLabel: 'Takım Özel Rozetleri',
    teamRestriction: 'Sıçrama Ustaları',
    condition: 'Matematik Neti ≥ 10',
    description: 'Sıçrama Ustaları takımında yer alan ve deneme sınavında Matematik dersinde 10 net ve üzerine çıkarak büyük sıçrama başlatan öğrenciye verilir.',
    bg: 'bg-blue-100',
    text: 'text-blue-900 font-bold',
    border: 'border-blue-200'
  },
  {
    key: 'dengeCambazi',
    label: 'Denge Cambazı',
    icon: '⚖️',
    lp: 15,
    category: 'team',
    categoryLabel: 'Takım Özel Rozetleri',
    teamRestriction: 'Sıçrama Ustaları',
    condition: 'Türkçe Neti ≥ 15 ve Fen Neti ≥ 15',
    description: 'Sıçrama Ustaları takımında hem Türkçe hem de Fen Bilimleri dersinde aynı anda 15 net ve üzeri çıkararak dengeli skor yakalayan öğrenciye verilir.',
    bg: 'bg-blue-100',
    text: 'text-blue-900 font-bold',
    border: 'border-blue-200'
  },
  {
    key: 'keskinNisanci',
    label: 'Keskin Nişancı',
    icon: '🎯',
    lp: 20,
    category: 'team',
    categoryLabel: 'Takım Özel Rozetleri',
    teamRestriction: 'Taktik Avcıları',
    condition: 'İşaretlenen Sorularda Doğruluk Oranı ≥ %70',
    description: 'Taktik Avcıları takımında sınavda işaretlediği (Doğru + Yanlış) sorular arasında en az %70 doğruluk isabetine ulaşan öğrenciye verilir.',
    bg: 'bg-emerald-100',
    text: 'text-emerald-900 font-bold',
    border: 'border-emerald-200'
  },
  {
    key: 'temelAtici',
    label: 'Temel Atıcı',
    icon: '🧱',
    lp: 15,
    category: 'team',
    categoryLabel: 'Takım Özel Rozetleri',
    teamRestriction: 'Taktik Avcıları',
    condition: 'Tüm Derslerde Netler ≥ 0 (Eksi Net Yok)',
    description: 'Taktik Avcıları takımında hiçbir derste eksi nete düşmeyerek sağlam temel oluşturan öğrenciye verilir.',
    bg: 'bg-emerald-100',
    text: 'text-emerald-900 font-bold',
    border: 'border-emerald-200'
  },

  // 4. Branş Ustaları
  {
    key: 'filozof',
    label: 'Filozof',
    icon: '📚',
    lp: 30,
    category: 'subject',
    categoryLabel: 'Branş Ustaları',
    condition: 'Türkçe 20 Doğru, 0 Yanlış (Fulleme)',
    description: 'Türkçe dersindeki tüm soruları firesiz ve hatasız 20/20 doğru yaparak fulleyen öğrenciye verilir.',
    bg: 'bg-rose-100',
    text: 'text-rose-900 font-bold',
    border: 'border-rose-200'
  },
  {
    key: 'newton',
    label: 'Newton',
    icon: '🔭',
    lp: 30,
    category: 'subject',
    categoryLabel: 'Branş Ustaları',
    condition: 'Fen Bilimleri 20 Doğru, 0 Yanlış (Fulleme)',
    description: 'Fen Bilimleri dersindeki tüm soruları eksiksiz ve hatasız 20/20 doğru yaparak fulleyen öğrenciye verilir.',
    bg: 'bg-sky-100',
    text: 'text-sky-900 font-bold',
    border: 'border-sky-200'
  },
  {
    key: 'pisagor',
    label: 'Pisagor',
    icon: '📐',
    lp: 50,
    category: 'subject',
    categoryLabel: 'Branş Ustaları',
    condition: 'Matematik 20 Doğru, 0 Yanlış (Fulleme)',
    description: 'LGS Matematik dersindeki tüm 20 soruyu sıfır hata ile eksiksiz doğru çözerek fulleyen üstün başarılı öğrenciye verilir.',
    bg: 'bg-emerald-100',
    text: 'text-emerald-900 font-bold',
    border: 'border-emerald-200'
  },

  // 5. Gizemli Rozetler
  {
    key: 'uyuyanDev',
    label: 'Uyuyan Dev',
    icon: '🦁',
    lp: 50,
    category: 'mystery',
    categoryLabel: 'Gizemli Rozetler',
    condition: 'Tek Sınavda +40 Puan Dev Sıçrama',
    description: 'Önceki sınav ortalamasına kıyasla tek bir sınavda en az 40 puanlık rekor artış gerçekleştirerek potansiyelini uyandıran öğrenciye verilir.',
    bg: 'bg-violet-100',
    text: 'text-violet-900 font-bold',
    border: 'border-violet-200'
  },
  {
    key: 'sabirTasi',
    label: 'Sabır Taşı',
    icon: '💎',
    lp: 40,
    category: 'mystery',
    categoryLabel: 'Gizemli Rozetler',
    condition: 'En Az 15 Boş ve 0 Yanlış',
    description: 'Sınavda bilmediği ve emin olmadığı en az 15 soruyu sabırla boş bırakıp sıfır yanlış yaparak hata yapmama iradesi gösteren öğrenciye verilir.',
    bg: 'bg-stone-100',
    text: 'text-stone-900 font-bold',
    border: 'border-stone-200'
  },
  {
    key: 'yinYang',
    label: 'Yin Yang',
    icon: '☯️',
    lp: 30,
    category: 'mystery',
    categoryLabel: 'Gizemli Rozetler',
    condition: 'Türkçe Neti = Matematik Neti (Net ≥ 10)',
    description: 'Sözelin lideri Türkçe ile sayısalın lideri Matematik derslerinde tam eşit ve en az 10 net elde ederek kusursuz denge kuran öğrenciye verilir.',
    bg: 'bg-zinc-100',
    text: 'text-zinc-900 font-bold',
    border: 'border-zinc-200'
  },

  // 6. Temel Koruma Rozetleri
  {
    key: 'kalkan',
    label: 'Kalkan',
    icon: '🛡️',
    lp: 20,
    category: 'core',
    categoryLabel: 'Temel Rozetler',
    condition: 'Boş Sayısı > Yanlış Sayısı',
    description: 'Toplam boş sayısı yanlış sayısından fazla olan öğrencilere risk yönetimi ve bilinçli soru çözümü ödülü olarak verilir.',
    bg: 'bg-amber-100',
    text: 'text-amber-900 font-bold',
    border: 'border-amber-200'
  },
  {
    key: 'zirve',
    label: 'Zirve Koruma',
    icon: '👑',
    lp: 15,
    category: 'core',
    categoryLabel: 'Temel Rozetler',
    condition: 'Sınav Puanı ≥ 400',
    description: 'Deneme sınavında 400 puan ve üzerine çıkarak şampiyonlar ligi standardını yakalayan öğrencilere verilir.',
    bg: 'bg-purple-100',
    text: 'text-purple-900 font-bold',
    border: 'border-purple-200'
  },
  {
    key: 'ivme',
    label: 'İvme',
    icon: '🚀',
    lp: 15,
    category: 'core',
    categoryLabel: 'Temel Rozetler',
    condition: 'Önceki Ortalamaya Göre Puan Artışı ≥ +2',
    description: 'Önceki deneme ortalamasına göre puanını en az 2 puan artırarak pozitif gelişim ivmesi yakalayan öğrenciye verilir.',
    bg: 'bg-blue-100',
    text: 'text-blue-900 font-bold',
    border: 'border-blue-200'
  },
  {
    key: 'tamIsabet',
    label: 'Tam İsabet',
    icon: '🎯',
    lp: 10,
    category: 'core',
    categoryLabel: 'Temel Rozetler',
    condition: 'Bir Derste 0 Yanlış ve En Az 1 Doğru',
    description: 'Herhangi bir ders testinde tek bir yanlış dahi yapmadan işaretlediği soruların tamamını doğru yapan öğrenciye ders başına verilir.',
    bg: 'bg-emerald-100',
    text: 'text-emerald-900 font-bold',
    border: 'border-emerald-200'
  },
  {
    key: 'kirmiziKart',
    label: 'Kırmızı Kart',
    icon: '🟥',
    lp: -15,
    category: 'core',
    categoryLabel: 'Temel Rozetler',
    teamRestriction: 'Kutup Yıldızları',
    condition: 'Kutup Yıldızlarında 15 ve Üzeri Yanlış',
    description: 'Zirve ligindeki Kutup Yıldızları takımında dikkatsiz çözümler sonucu 15 veya daha fazla yanlış yapan öğrenciye verilen -15 LP ceza kartıdır.',
    bg: 'bg-rose-100',
    text: 'text-rose-900 font-bold',
    border: 'border-rose-200'
  },
  {
    key: 'takimRuhu',
    label: 'Takım Ruhu',
    icon: '🤝',
    lp: 20,
    category: 'core',
    categoryLabel: 'Temel Rozetler',
    condition: 'Takım Dayanışması ve Ortalamaya Katkı',
    description: 'Lig içerisinde takımının ortalama puanını yukarı taşıyan ve lig katılımını aksatmayan öğrencilere takdir amaçlı verilir.',
    bg: 'bg-teal-100',
    text: 'text-teal-900 font-bold',
    border: 'border-teal-200'
  }
];

export const BADGE_MAP_BY_KEY: Record<string, BadgeDefinition> = ALL_BADGE_DEFINITIONS.reduce((acc, b) => {
  acc[b.key] = b;
  return acc;
}, {} as Record<string, BadgeDefinition>);

export function normalizeBadgeKey(rawKey: string): string | null {
  if (!rawKey) return null;
  const k = rawKey.toLowerCase().replace(/[\s\.\-_]+/g, '');
  if (k.includes('lgsfatih')) return 'lgsFatihi';
  if (k.includes('ankakus')) return 'ankaKusu';
  if (k.includes('zirvebekcisi')) return 'zirveBekcisi';
  if (k.includes('ivmesampiyonu')) return 'ivmeSampiyonu';
  if (k.includes('barajyikici')) return 'barajYikici';
  if (k.includes('stratejimuhendisi') || k.includes('stratejimh')) return 'stratejiMuhendisi';
  if (k.includes('istikrarelcisi')) return 'istikrarElcisi';
  if (k.includes('sozelsovalye')) return 'sozelSovalyesi';
  if (k.includes('sayisalkale')) return 'sayisalKalesi';
  if (k.includes('matematikuyanis') || k.includes('matuyanis')) return 'matematikUyanisi';
  if (k.includes('dengecambaz')) return 'dengeCambazi';
  if (k.includes('keskinnisan')) return 'keskinNisanci';
  if (k.includes('temelatici')) return 'temelAtici';
  if (k.includes('filozof')) return 'filozof';
  if (k.includes('newton')) return 'newton';
  if (k.includes('pisagor')) return 'pisagor';
  if (k.includes('uyuyandev')) return 'uyuyanDev';
  if (k.includes('sabirtasi')) return 'sabirTasi';
  if (k.includes('yinyang')) return 'yinYang';
  if (k.includes('kalkan')) return 'kalkan';
  if (k.includes('zirve')) return 'zirve';
  if (k.includes('ivme')) return 'ivme';
  if (k.includes('tamisabet')) return 'tamIsabet';
  if (k.includes('kirmizikart')) return 'kirmiziKart';
  if (k.includes('takimruhu')) return 'takimRuhu';
  return null;
}

export function getBadgeDefinition(rawKey: string): BadgeDefinition | undefined {
  const normKey = normalizeBadgeKey(rawKey) || rawKey;
  return BADGE_MAP_BY_KEY[normKey];
}

export const BADGE_POINTS: Record<string, number> = {
  lgsFatihi: 200,
  ankaKusu: 100,
  zirveBekcisi: 30,
  ivmeSampiyonu: 30,
  barajYikici: 30,
  stratejiMuhendisi: 40,
  istikrarElcisi: 50,
  sozelSovalyesi: 15,
  sayisalKalesi: 20,
  matematikUyanisi: 20,
  dengeCambazi: 15,
  keskinNisanci: 20,
  temelAtici: 15,
  filozof: 30,
  newton: 30,
  pisagor: 50,
  uyuyanDev: 50,
  sabirTasi: 40,
  yinYang: 30,
  kalkan: 20,
  zirve: 15,
  ivme: 15,
  tamIsabet: 10,
  kirmiziKart: -15,
  takimRuhu: 20
};
