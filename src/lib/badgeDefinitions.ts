import { normalizeTurkish } from './omrEngine';

export interface BadgeDefinition {
  key: string;
  label: string;
  category: 'all' | 'team' | 'exam' | 'academic' | 'progress' | 'special';
  categoryLabel: string;
  condition: string;
  description: string;
  icon: string;
  lp: number;
  teamRestriction?: string;
  bg?: string;
  text?: string;
  border?: string;
}

export const BADGE_CATEGORIES = [
  { id: 'all', label: 'Tüm Rozetler', icon: '🏆' },
  { id: 'team', label: 'Takım & Baraj', icon: '⭐' },
  { id: 'exam', label: 'Sınav Başarıları', icon: '🎯' },
  { id: 'academic', label: 'Ders Bazlı', icon: '📚' },
  { id: 'progress', label: 'Gelişim & İstikrar', icon: '🚀' },
  { id: 'special', label: 'Özel & Efsanevi', icon: '👑' },
];

export const BADGE_POINTS: Record<string, number> = {
  lgsFatihi: 30,
  ankaKusu: 25,
  zirveBekcisi: 20,
  ivmeSampiyonu: 15,
  barajYikici: 12,
  stratejiMuhendisi: 10,
  istikrarElcisi: 15,
  sozelSovalyesi: 10,
  sayisalKalesi: 12,
  matematikUyanisi: 8,
  dengeCambazi: 8,
  keskinNisanci: 6,
  temelAtici: 5,
  filozof: 8,
  newton: 10,
  pisagor: 10,
  uyuyanDev: 10,
  sabirTasi: 5,
  yinYang: 8,
  kalkan: 5,
  zirve: 15,
  ivme: 8,
  tamIsabet: 10,
  kirmiziKart: -10,
  takimRuhu: 8,
  // Normalize aliases
  tamisabet: 10,
  zirvekoruma: 15,
  kirmizikart: -10
};

export const ALL_BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Efsanevi & Özel
  {
    key: 'lgsFatihi',
    label: 'LGS Fatihi',
    category: 'special',
    categoryLabel: 'Efsanevi Rozet',
    condition: 'Denemede tüm soruları 0 yanlış ve 0 boş ile bitirmek',
    description: 'Sınavın tüm sorularını eksiksiz ve tam doğrulukla tamamlayan şampiyon öğrenciye verilir.',
    icon: '🏆',
    lp: 30,
    bg: 'bg-amber-500',
    text: 'text-white font-extrabold',
    border: 'border-amber-400'
  },
  {
    key: 'ankaKusu',
    label: 'Anka Kuşu',
    category: 'special',
    categoryLabel: 'Efsanevi Rozet',
    condition: 'Taktik Avcıları liginden bir üst lige transfer olmak',
    description: 'Temel liginden gelişim göstererek üst lige terfi eden küllerinden doğan öğrencilere verilir.',
    icon: '🔥',
    lp: 25,
    bg: 'bg-gradient-to-r from-orange-500 to-amber-500',
    text: 'text-white font-extrabold',
    border: 'border-orange-400'
  },

  // Uzmanlık & Gelişim
  {
    key: 'zirveBekcisi',
    label: 'Zirve Bekçisi',
    category: 'progress',
    categoryLabel: 'Gelişim & İstikrar',
    condition: 'Üst üste 3 denemede 400+ puan barajını korumak',
    description: 'Zirvedeki yerini sarsılmaz istikrarla koruyan Kutup Yıldızları öğrencilerine verilir.',
    icon: '🏰',
    lp: 20,
    teamRestriction: 'Kutup Yıldızları',
    bg: 'bg-fuchsia-100',
    text: 'text-fuchsia-900 font-bold',
    border: 'border-fuchsia-200'
  },
  {
    key: 'ivmeSampiyonu',
    label: 'İvme Şampiyonu',
    category: 'progress',
    categoryLabel: 'Gelişim & İstikrar',
    condition: 'Bir önceki denemeye göre +25 puan veya +10 net sıçrama yapmak',
    description: 'Büyük sıçrama göstererek potansiyelini katlayan öğrencilere verilir.',
    icon: '⚡',
    lp: 15,
    teamRestriction: 'Sıçrama Ustaları',
    bg: 'bg-cyan-100',
    text: 'text-cyan-900 font-bold',
    border: 'border-cyan-200'
  },
  {
    key: 'barajYikici',
    label: 'Baraj Yıkıcı',
    category: 'progress',
    categoryLabel: 'Gelişim & İstikrar',
    condition: 'Zorlanılan derste hedeflenen net barajını ilk kez aşmak',
    description: 'Kritik barajları yıkarak başarı grafiğini yukarı taşıyan öğrencilere verilir.',
    icon: '🔨',
    lp: 12,
    bg: 'bg-orange-100',
    text: 'text-orange-900 font-bold',
    border: 'border-orange-200'
  },
  {
    key: 'stratejiMuhendisi',
    label: 'Strateji Mh.',
    category: 'progress',
    categoryLabel: 'Gelişim & İstikrar',
    condition: 'Sınavda turlama taktiğini hatasız uygulayıp süreyi verimli kullanmak',
    description: 'Zamanı ve soru dağılımını taktiksel zekayla yöneten öğrencilere verilir.',
    icon: '🧠',
    lp: 10,
    teamRestriction: 'Taktik Avcıları',
    bg: 'bg-indigo-100',
    text: 'text-indigo-900 font-bold',
    border: 'border-indigo-200'
  },
  {
    key: 'istikrarElcisi',
    label: 'İstikrar Elçisi',
    category: 'progress',
    categoryLabel: 'Gelişim & İstikrar',
    condition: 'Ardı ardına 4 denemede puanını sabit tutup gerilememek',
    description: 'Dalgalanma yaşamadan disiplinli net çizgisini sürdüren öğrencilere verilir.',
    icon: '🕊️',
    lp: 15,
    bg: 'bg-teal-100',
    text: 'text-teal-900 font-bold',
    border: 'border-teal-200'
  },

  // Takım & Sınav
  {
    key: 'sozelSovalyesi',
    label: 'Sözel Şövalyesi',
    category: 'team',
    categoryLabel: 'Takım & Baraj',
    condition: 'Türkçe, Din, İnkılap ve İngilizce branşlarında 0 yanlış yapmak',
    description: 'Sözel bölümü firesiz ve eksiksiz geçerek okulunu zirveye taşıyan öğrencilere verilir.',
    icon: '📜',
    lp: 10,
    teamRestriction: 'Kutup Yıldızları',
    bg: 'bg-amber-100',
    text: 'text-amber-900 font-bold',
    border: 'border-amber-200'
  },
  {
    key: 'sayisalKalesi',
    label: 'Sayısal Kalesi',
    category: 'team',
    categoryLabel: 'Takım & Baraj',
    condition: 'Matematik ve Fen derslerinde en fazla 2 yanlış yapmak',
    description: 'Sayısal bölümde sağlam durarak netlerini güvenceye alan öğrencilere verilir.',
    icon: '🏰',
    lp: 12,
    teamRestriction: 'Kutup Yıldızları',
    bg: 'bg-amber-100',
    text: 'text-amber-900 font-bold',
    border: 'border-amber-200'
  },
  {
    key: 'matematikUyanisi',
    label: 'Mat. Uyanışı',
    category: 'team',
    categoryLabel: 'Takım & Baraj',
    condition: 'Matematik branşında 10 ve üzeri nete ulaşmak',
    description: 'Matematik korkusunu yenip çift haneli netlere sıçrayan öğrencilere verilir.',
    icon: '💡',
    lp: 8,
    teamRestriction: 'Sıçrama Ustaları',
    bg: 'bg-blue-100',
    text: 'text-blue-900 font-bold',
    border: 'border-blue-200'
  },
  {
    key: 'dengeCambazi',
    label: 'Denge Cambazı',
    category: 'team',
    categoryLabel: 'Takım & Baraj',
    condition: 'Türkçe ve Fen derslerinde 15+ net dengesini kurmak',
    description: 'İki ana ders arasında kusursuz bir denge sağlayan öğrencilere verilir.',
    icon: '⚖️',
    lp: 8,
    teamRestriction: 'Sıçrama Ustaları',
    bg: 'bg-blue-100',
    text: 'text-blue-900 font-bold',
    border: 'border-blue-200'
  },
  {
    key: 'keskinNisanci',
    label: 'Keskin Nişancı',
    category: 'exam',
    categoryLabel: 'Sınav Başarıları',
    condition: 'İşaretlenen sorularda %70 ve üzeri isabet oranına ulaşmak',
    description: 'Sadece emin olduğu soruları işaretleyerek yüksek doğruluk oranı yakalayanlara verilir.',
    icon: '🎯',
    lp: 6,
    bg: 'bg-emerald-100',
    text: 'text-emerald-900 font-bold',
    border: 'border-emerald-200'
  },
  {
    key: 'temelAtici',
    label: 'Temel Atıcı',
    category: 'team',
    categoryLabel: 'Takım & Baraj',
    condition: 'Hiçbir derste eksi nete düşmeden tüm dersleri pozitif bitirmek',
    description: 'Doğru taktikle eksi net riskini sıfırlayan öğrencilere verilir.',
    icon: '🧱',
    lp: 5,
    teamRestriction: 'Taktik Avcıları',
    bg: 'bg-emerald-100',
    text: 'text-emerald-900 font-bold',
    border: 'border-emerald-200'
  },

  // Branş Efsaneleri
  {
    key: 'filozof',
    label: 'Filozof',
    category: 'academic',
    categoryLabel: 'Ders Bazlı',
    condition: 'Türkçe dersinde 20/20 tam doğru yapmak',
    description: 'Paragraf, dil bilgisi ve anlama kabiliyetiyle Türkçe testini fetheden öğrencilere verilir.',
    icon: '📚',
    lp: 8,
    bg: 'bg-rose-100',
    text: 'text-rose-900 font-bold',
    border: 'border-rose-200'
  },
  {
    key: 'newton',
    label: 'Newton',
    category: 'academic',
    categoryLabel: 'Ders Bazlı',
    condition: 'Fen Bilimleri dersinde 20/20 tam doğru yapmak',
    description: 'Deney, mantık ve fizik/kimya/biyoloji sorularını firesiz çözen bilim ustalarına verilir.',
    icon: '🔭',
    lp: 10,
    bg: 'bg-sky-100',
    text: 'text-sky-900 font-bold',
    border: 'border-sky-200'
  },
  {
    key: 'pisagor',
    label: 'Pisagor',
    category: 'academic',
    categoryLabel: 'Ders Bazlı',
    condition: 'Matematik dersinde 20/20 tam doğru yapmak',
    description: 'Yeni nesil mantık muhakeme ve geometri sorularının tamamını doğru yapan dâhilere verilir.',
    icon: '📐',
    lp: 10,
    bg: 'bg-emerald-100',
    text: 'text-emerald-900 font-bold',
    border: 'border-emerald-200'
  },

  // Gizemli Rozetler
  {
    key: 'uyuyanDev',
    label: 'Uyuyan Dev',
    category: 'special',
    categoryLabel: 'Özel & Efsanevi',
    condition: 'Beklenmedik bir şekilde takımının en yüksek puan sıçramasını gerçekleştirmek',
    description: 'Potansiyelini açığa çıkarıp herkesi şaşırtan sıçramayı yapan öğrenciye verilir.',
    icon: '🦁',
    lp: 10,
    bg: 'bg-violet-100',
    text: 'text-violet-900 font-bold',
    border: 'border-violet-200'
  },
  {
    key: 'sabirTasi',
    label: 'Sabır Taşı',
    category: 'exam',
    categoryLabel: 'Sınav Başarıları',
    condition: 'Zor sorularda inatlaşmayıp sınav sonuna kadar odaklanarak süreyi tam kullanmak',
    description: 'Panik yapmadan sınav psikolojisini ve kriz anını soğukkanlılıkla yöneten öğrencilere verilir.',
    icon: '💎',
    lp: 5,
    bg: 'bg-stone-100',
    text: 'text-stone-900 font-bold',
    border: 'border-stone-200'
  },
  {
    key: 'yinYang',
    label: 'Yin Yang',
    category: 'exam',
    categoryLabel: 'Sınav Başarıları',
    condition: 'Sözel ve sayısal oturumlardan birbirine eşit oranda net çıkarmak',
    description: 'Her iki oturumda da eşdeğer performans sergileyen öğrencilere verilir.',
    icon: '☯️',
    lp: 8,
    bg: 'bg-zinc-100',
    text: 'text-zinc-900 font-bold',
    border: 'border-zinc-200'
  },

  // Temel Rozetler
  {
    key: 'kalkan',
    label: 'Kalkan',
    category: 'exam',
    categoryLabel: 'Sınav Başarıları',
    condition: 'Boş sayısı yanlış sayısından fazla olmak (Boş > Yanlış)',
    description: 'Atmasyon yapmayıp bilmediği soruyu boş bırakarak netini koruyan defansif kahramanlara verilir.',
    icon: '🛡️',
    lp: 5,
    bg: 'bg-amber-100',
    text: 'text-amber-900 font-bold',
    border: 'border-amber-200'
  },
  {
    key: 'zirve',
    label: 'Zirve',
    category: 'team',
    categoryLabel: 'Takım & Baraj',
    condition: 'Denemede 400 ve üzeri LGS puanı elde etmek',
    description: 'Kutup Yıldızları lig barajını başarıyla aşan öğrencilere verilir.',
    icon: '👑',
    lp: 15,
    bg: 'bg-purple-100',
    text: 'text-purple-900 font-bold',
    border: 'border-purple-200'
  },
  {
    key: 'ivme',
    label: 'İvme',
    category: 'progress',
    categoryLabel: 'Gelişim & İstikrar',
    condition: 'Önceki sınava göre puanını artırmak',
    description: 'Sürekli gelişim gösterip net çizgisini yükselten öğrencilere verilir.',
    icon: '🚀',
    lp: 8,
    bg: 'bg-blue-100',
    text: 'text-blue-900 font-bold',
    border: 'border-blue-200'
  },
  {
    key: 'tamIsabet',
    label: 'Tam İsabet',
    category: 'academic',
    categoryLabel: 'Ders Bazlı',
    condition: 'Herhangi bir branşta 0 yanlış ve en az 1 doğru yapmak',
    description: 'Dersi hatasız tamamlayan keskin zekalara verilir.',
    icon: '🎯',
    lp: 10,
    bg: 'bg-emerald-100',
    text: 'text-emerald-900 font-bold',
    border: 'border-emerald-200'
  },
  {
    key: 'kirmiziKart',
    label: 'Kırmızı Kart',
    category: 'special',
    categoryLabel: 'Özel & Efsanevi',
    condition: 'Sınavda yanlış sayısı doğru sayısından fazla olmak',
    description: 'Çok fazla tahminde bulunarak net kaybı yaşayan öğrencilere uyarı amaçlı verilir.',
    icon: '🟥',
    lp: -10,
    bg: 'bg-rose-100',
    text: 'text-rose-900 font-bold',
    border: 'border-rose-200'
  },
  {
    key: 'takimRuhu',
    label: 'Takım Ruhu',
    category: 'team',
    categoryLabel: 'Takım & Baraj',
    condition: 'Takım arkadaşlarıyla ortak çalışma ve koçluk hedefini tamamlamak',
    description: 'Akran mentörlüğü ve dayanışmayla takım ortalamasını yükselten öğrencilere verilir.',
    icon: '🤝',
    lp: 8,
    bg: 'bg-teal-100',
    text: 'text-teal-900 font-bold',
    border: 'border-teal-200'
  }
];

export function getBadgeDefinition(keyOrLabel: string): BadgeDefinition | undefined {
  if (!keyOrLabel) return undefined;
  const direct = ALL_BADGE_DEFINITIONS.find(b => b.key === keyOrLabel || b.label === keyOrLabel);
  if (direct) return direct;

  const normalized = normalizeBadgeKey(keyOrLabel);
  return ALL_BADGE_DEFINITIONS.find(b => b.key === normalized || normalizeBadgeKey(b.label) === normalized);
}

export function normalizeBadgeKey(rawKey: string): string {
  if (!rawKey) return '';
  const k = normalizeTurkish(rawKey).toLowerCase().replace(/[\s\.\-_]+/g, '');
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
  return k;
}
