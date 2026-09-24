import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Calendar,
  Users,
  LayoutTemplate,
  Printer,
  Camera,
  TrendingUp,
  Trophy,
  DollarSign,
  Cloud,
  Zap,
  Sparkles,
  Search,
  ExternalLink,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Lightbulb,
  ChevronRight,
  HelpCircle,
  Layers,
  BookOpen,
  MousePointerClick,
  Compass,
  Check,
  Share2,
  ListOrdered
} from 'lucide-react';

interface InstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: number;
}

interface StepItem {
  id: number;
  category: 'exam' | 'analysis' | 'admin';
  categoryLabel: string;
  targetTab?: string;
  badge: string;
  stageName: string;
  title: string;
  icon: React.ElementType;
  gradient: string;
  tagColor: string;
  summary: string;
  keyPoints: string[];
  proTip: string;
  tags: string[];
  mockData?: {
    stat1: { label: string; value: string };
    stat2: { label: string; value: string };
    tipHighlight: string;
  };
}

const ALL_STEPS: StepItem[] = [
  {
    id: 1,
    category: 'exam',
    categoryLabel: 'Sınav & Planlama',
    targetTab: 'exams',
    badge: '1. Adım',
    stageName: 'Sınav Takvimi',
    title: 'Sınav Takvimi ve Deneme Planlaması',
    icon: Calendar,
    gradient: 'from-rose-500 via-pink-600 to-rose-700',
    tagColor: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    summary: 'Okulunuzda uygulanacak tüm deneme sınavlarını türlerine göre planlayın ve takvime ekleyin.',
    keyPoints: [
      'Deneme türünü belirleyin: "🎯 Kurum İçi Optik Deneme" (okulda basılıp okutulan) veya "📑 Yayıncı / Excel Denemesi" (dışarıdan Excel ile yüklenen).',
      'Hedef sınıf seviyesini (5, 6, 7 veya 8. Sınıf), sınav tarihini, soru sayısını ve oturum detaylarını tanımlayın.',
      'Planlanan sınavlar takvim üzerinde renkli olarak listelenir ve öğretmenler ile öğrencilere anlık duyurulur.',
      'Sınavlar oluşturulduktan sonra sırasıyla öğrenci listeleri, salon yerleşimi ve optik form baskısı süreçlerine geçilir.'
    ],
    proTip: 'Kurum içi denemeler için girdiğiniz ders dağılımı ve soru sayıları, baskı ve tarama modülleriyle otomatik senkronize olur.',
    tags: ['Kurum İçi & Yayıncı Sınavları', 'Takvim Planlama', 'Hedef Kitle & Bildirimler'],
    mockData: {
      stat1: { label: 'Sınav Türleri', value: 'Kurum İçi & Dış Yayın' },
      stat2: { label: 'Entegrasyon', value: 'Takvim & Duyuru' },
      tipHighlight: 'Tüm sınav takvimi merkezi Firestore bulutunda tutulur.'
    }
  },
  {
    id: 2,
    category: 'exam',
    categoryLabel: 'Öğrenci Kütüğü',
    targetTab: 'students',
    badge: '2. Adım',
    stageName: 'Öğrenci Kayıtları',
    title: 'Öğrenci Listesi ve e-Okul / Excel Aktarımı',
    icon: Users,
    gradient: 'from-indigo-500 via-blue-600 to-indigo-700',
    tagColor: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    summary: 'Tüm okul kütüğünü tek tıkla sisteme aktarın, sınıf ve şube bazlı düzenleyin.',
    keyPoints: [
      'e-Okul veya Excel formatındaki öğrenci listesini sürükleyip bırakarak saniyeler içinde binlerce öğrenciyi içeri aktarın.',
      'Öğrencilerin adı, soyadı, okul numarası, sınıfı ve şubesi otomatik olarak ayrıştırılır ve merkezi veritabanına kaydedilir.',
      'Öğrenci arama, filtreleme, şube bazlı listeleme ve bireysel profil düzenleme işlemlerini kolayca yapın.',
      'Karekodlu optik formlar ve kelebek salon yerleşimleri doğrudan bu kütükteki güncel öğrenci verileriyle çalışır.'
    ],
    proTip: 'Öğrenci numaralarının doğru girilmiş olması, optik formlardaki QR kodların sorunsuz eşleşmesini sağlar.',
    tags: ['e-Okul & Excel İçe Aktarma', 'Merkezi Kütük', 'Şube & Numara Yönetimi'],
    mockData: {
      stat1: { label: 'Aktarım Formatı', value: 'Excel / e-Okul / CSV' },
      stat2: { label: 'Arama Hızı', value: '< 10 ms Canlı Filtre' },
      tipHighlight: 'Binlerce öğrenci kaydı anında arama ve şube filtrelerine hazırdır.'
    }
  },
  {
    id: 3,
    category: 'exam',
    categoryLabel: 'Salon & Yerleşim',
    targetTab: 'halls',
    badge: '3. Adım',
    stageName: 'Kelebek Salon Düzeni',
    title: 'Salonlar ve Kopya Önleyici Kelebek Yerleşim',
    icon: LayoutTemplate,
    gradient: 'from-sky-500 via-cyan-600 to-sky-700',
    tagColor: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    summary: 'Sınav salonlarını oluşturun ve öğrencileri kopya ihtimalini sıfırlayan Kelebek Sistemi ile sıralara dağıtın.',
    keyPoints: [
      'Okuldaki derslikleri (salon adı, sıra sayısı ve salon kapasitesi) sisteme tanımlayın.',
      '"Otomatik Kelebek Dağıtımı" butonuna basarak farklı sınıf ve şubelerdeki öğrencilerin yan yana/arka arkaya gelmesini engelleyen çapraz algoritmayı çalıştırın.',
      'Her salon için hazır "Kapı Giriş Listesi" ve sıraların üzerine yapıştırılacak "Öğrenci Sıra Etiketleri" çıktısını tek tıkla alın.',
      'Yoklama tutanakları ve salon görevlisi dağıtım çizelgelerini anında yazdırın.'
    ],
    proTip: 'Kelebek sistemi sayesinde 8. sınıf öğrencisi ile 5. sınıf öğrencisi çapraz oturur, sınav güvenliği maksimum düzeye çıkar.',
    tags: ['Otomatik Kelebek Algoritması', 'Kapı Giriş Listeleri', 'Sıra Üzeri Etiket Baskısı'],
    mockData: {
      stat1: { label: 'Kopya Riski', value: '%0 Çapraz Dağıtım' },
      stat2: { label: 'Çıktılar', value: 'Kapı Listesi & Sıra Etiketi' },
      tipHighlight: 'Her salon için sıralı oturma krokisi tek tıkla PDF olarak yazdırılır.'
    }
  },
  {
    id: 4,
    category: 'exam',
    categoryLabel: 'Baskı & Formlar',
    targetTab: 'keys_print',
    badge: '4. Adım',
    stageName: 'Cevap & Form Baskı',
    title: 'Cevap Anahtarı Girişi ve Karekodlu A4 Optik Baskı',
    icon: Printer,
    gradient: 'from-purple-500 via-purple-600 to-indigo-800',
    tagColor: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    summary: 'Ders şablonunu belirleyin, doğru cevapları girin ve her öğrenciye özel QR kodlu A4 optik form basın.',
    keyPoints: [
      'LGS (90 soru), TYT (120 soru), Ortaokul 5-7 (75 soru) veya Tek Branş hazır şablonlarından birini seçin ya da derslerinizi özelleştirin.',
      'A, B, C, D kitapçıklarının doğru şıklarını kabarcıklara tıklayarak veya metin yapıştırarak saniyeler içinde kaydedin.',
      'Seçtiğiniz sınıf veya tüm okul için her öğrencinin okul numarası, adı ve benzersiz QR kodunun basılı olduğu A4 optik formlar üretin.',
      '"Toplu Form Yazdır / PDF İndir" butonuyla renkli (kırmızı optik) veya toner tasarruflu siyah-beyaz formları tek seferde yazdırın.'
    ],
    proTip: 'Kişiye özel QR kod sayesinde öğrencinin optik forma numara kodlamasına gerek kalmaz; kodlama hataları %100 engellenir.',
    tags: ['Kişiye Özel QR Kodlu Form', 'A-B-C-D Kitapçık Anahtarları', 'Toplu PDF & A4 Baskı'],
    mockData: {
      stat1: { label: 'Form Türü', value: 'Karekodlu A4 Standart' },
      stat2: { label: 'Baskı Modları', value: 'Kırmızı Optik / Siyah-Beyaz' },
      tipHighlight: 'Öğrenci adı uzun olduğunda yazı boyutu otomatik ölçeklenir.'
    }
  },
  {
    id: 5,
    category: 'exam',
    categoryLabel: 'Optik Tarama',
    targetTab: 'scan',
    badge: '5. Adım',
    stageName: 'Canlı Optik Tarayıcı',
    title: 'Akıllı Kamera & Dosya ile 0.1 sn Anında Optik Okuma',
    icon: Camera,
    gradient: 'from-teal-500 via-emerald-600 to-teal-700',
    tagColor: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
    summary: 'Telefon veya bilgisayar kamerasıyla sınav kağıtlarını 0.1 saniyede otomatik okutun veya PDF yükleyin.',
    keyPoints: [
      'Kamerayı kağıdın 4 köşesindeki siyah hizalama karelerine doğrulttuğunuzda sistem otomatik olarak odaklanır ve çeker.',
      'Matematiksel homografi düzeltmesi sayesinde kağıt eğri tutulsa dahi açıyı otomatik düzeltir ve kabarcıkları hatasız okur.',
      'Öğrencinin kim olduğu QR koddan anında algılanır; işaretlediği kitapçık türüne göre doğru cevaplarla eşleştirilir.',
      'Fotokopi/tarayıcıdan aldığınız çok sayfalı PDF dosyalarını veya fotoğrafları sürükleyip bırakarak toplu tarama yapabilirsiniz.'
    ],
    proTip: 'Okunan her sonuç anında Firestore bulut veritabanına işlenir, öğrencinin netleri ve lig puanları canlı olarak hesaplanır.',
    tags: ['0.1 sn Kamera İle Tarama', 'Otomatik Homografi Düzeltme', 'Toplu PDF / Fotoğraf Okuma'],
    mockData: {
      stat1: { label: 'Okuma Hızı', value: '~0.1 Saniye / Sayfa' },
      stat2: { label: 'Hizalama', value: '4 Köşe Çapa Homografisi' },
      tipHighlight: 'Kamera sabitlendiğinde otomatik yakalama devreye girer.'
    }
  },
  {
    id: 6,
    category: 'analysis',
    categoryLabel: 'Analiz & Karneler',
    targetTab: 'results',
    badge: '6. Adım',
    stageName: 'Sonuçlar & Karneler',
    title: 'Detaylı Sonuç Analizi, Sıralamalar ve Renkli Karneler',
    icon: TrendingUp,
    gradient: 'from-emerald-500 via-teal-700 to-cyan-800',
    tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    summary: 'Sınav sonuçlarını ders ve kazanım bazında analiz edin, renkli öğrenci karnelerini tek tıkla bastırın.',
    keyPoints: [
      'Okul, sınıf ve şube bazlı sıralamalar, genel ortalamalar ve net dağılımları anında tablo ve grafiklerle sunulur.',
      'Soru & Madde Analizi sekmesinden her sorunun doğru, yanlış ve boş bırakılma oranlarını, öğrencilerin en çok düştüğü çeldiricileri görün.',
      'Her öğrenci için son 3 sınavdaki gelişim trend grafiğini de içeren şık, renkli Bireysel Öğrenci Karnesi yazdırın.',
      'Toplu karne yazdırma, Excel sonuç çizelgesi indirme ve veli bilgilendirme formatında dışa aktarma yapın.'
    ],
    proTip: 'Öğrencinin son denemelerindeki net gelişim grafiği karne üzerinde otomatik çizilir, öğrenci motivasyonunu artırır.',
    tags: ['Renkli Öğrenci Karneleri', 'Madde & Çeldirici Analizi', 'Net Gelişim Çizgi Grafiği'],
    mockData: {
      stat1: { label: 'Karne Formatı', value: 'Grafikli Renkli A4' },
      stat2: { label: 'Madde Analizi', value: 'Çeldirici & Güçlük İndeksi' },
      tipHighlight: 'Son 3 sınav gelişim çizgisi Recharts ile karneye entegredir.'
    }
  },
  {
    id: 7,
    category: 'analysis',
    categoryLabel: 'Oyunlaştırma & Lig',
    targetTab: 'league',
    badge: '7. Adım',
    stageName: 'Akademi Arena',
    title: 'Akademi Arena Oyunlaştırılmış Lig & Takım Sistemi',
    icon: Trophy,
    gradient: 'from-amber-400 via-yellow-500 to-orange-500',
    tagColor: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    summary: 'Sınav netlerini Lig Puanına (LP) dönüştürerek öğrencileri motive eden oyunlaştırılmış okul ligi.',
    keyPoints: [
      'Öğrenciler netlerine ve sınavdan sınava gösterdikleri sıçrama/gelişime göre dinamik Lig Puanı (LP) kazanırlar.',
      'Öğrenciler 3 büyük takıma ayrılır: "⭐ Kutup Yıldızları", "🚀 Sıçrama Ustaları" ve "🛡️ Taktik Avcıları".',
      'Haftalık ve aylık liderlik tabloları, podyum dereceleri ve başarı rozetleri (Kalkan, Zirve, İvme, Tam İsabet) verilir.',
      'Takım içi puan ortalamaları ve en çok sıçrama yapan öğrencilerin listesi okul panolarında sergilenmeye hazır formatta sunulur.'
    ],
    proTip: 'Sadece yüksek net yapanlar değil, önceki sınavına göre netini en çok artıran öğrenciler de ekstra sıçrama bonusu kazanır.',
    tags: ['Lig Puanı (LP) Sistemi', '3 Büyük Takım Rekabeti', 'Başarı & Sıçrama Rozetleri'],
    mockData: {
      stat1: { label: 'Takımlar', value: 'Kutup / Sıçrama / Taktik' },
      stat2: { label: 'Podyum', value: 'Altın, Gümüş, Bronz' },
      tipHighlight: 'Her sınav sonrası net artışlarına göre rozetler güncellenir.'
    }
  },
  {
    id: 8,
    category: 'admin',
    categoryLabel: 'Mali Yönetim',
    targetTab: 'budget',
    badge: '8. Adım',
    stageName: 'Bütçe & Finans',
    title: 'Deneme Sınavları Bütçe ve Gelir-Gider Takibi',
    icon: DollarSign,
    gradient: 'from-cyan-500 via-teal-600 to-emerald-700',
    tagColor: 'bg-cyan-100 text-cyan-900 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800',
    summary: 'Okulun deneme sınavı bütçesini, fotokopi/yayın masraflarını ve öğrenci katılım ücretlerini yönetin.',
    keyPoints: [
      'Sınav başına fotokopi, kağıt, toner ve yayın maliyetlerini kalem kalem gelir-gider tablosuna kaydedin.',
      'Öğrenci katılım ücretleri, ödeme yapan ve bekleyen öğrenciler listesi üzerinden mali denetimi sağlayın.',
      'Kasa durumu, net kar/zarar dengesi ve maliyet analiz raporlarını grafiklerle görüntüleyin.',
      'Okul aile birliği veya yönetim kurulu için anlık finansal özet raporu ve Excel dökümü alın.'
    ],
    proTip: 'Bütçe modülü yalnızca Yönetici (Admin) yetkisine sahip kullanıcılar tarafından görüntülenebilir ve düzenlenebilir.',
    tags: ['Gelir & Gider Yönetimi', 'Öğrenci Katılım Takibi', 'Finansal Kasa Raporları'],
    mockData: {
      stat1: { label: 'Erişim', value: 'Yönetici (Admin) Korumalı' },
      stat2: { label: 'Raporlama', value: 'Gelir-Gider & Kasa Özeti' },
      tipHighlight: 'Her sınav için birim maliyet ve katılım tahsilatı hesaplanır.'
    }
  },
  {
    id: 9,
    category: 'admin',
    categoryLabel: 'Bulut & Güvenlik',
    badge: '9. Adım',
    stageName: 'Bulut & Yedekleme',
    title: 'Canlı Bulut Senkronizasyonu & Güvenli JSON Yedekleme',
    icon: Cloud,
    gradient: 'from-blue-500 via-indigo-600 to-slate-800',
    tagColor: 'bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    summary: 'Tüm öğrenci, sınav, sonuç ve salon verileriniz yerel hafızada tam koruma altındadır ve JSON ile kolayca yedeklenir.',
    keyPoints: [
      'Yapılan her işlem (öğrenci ekleme, optik tarama, cevap anahtarı) cihazınızın güvenli yerel hafızasında anında saklanır.',
      'İnternet bağlantısı olmasa dahi kesintisiz ve tam performanslı çalışma garantisi sunulur.',
      '"Tam Sistem Yedeği İndir" butonuyla tüm okul veritabanını tek bir JSON dosyası halinde bilgisayarınıza veya telefonunuza kaydedebilirsiniz.',
      'İhtiyaç halinde JSON yedeğini yükleyerek saniyeler içinde tüm sistemi eski veya yeni bir cihaza eksiksiz geri yükleyebilirsiniz.'
    ],
    proTip: 'Düzenli aralıklarla "Tam Sistem Yedeği İndir" butonunu kullanarak okul verilerinizin harici bir kopyasını bilgisayarınızda saklamanız önerilir.',
    tags: ['Yerel Güvenli Depolama', 'Çevrimdışı Tam Destek', 'Tek Tıkla JSON Yedek/Geri Yükle'],
    mockData: {
      stat1: { label: 'Altyapı', value: 'Yerel Depolama & Yedekleme' },
      stat2: { label: 'Çevrimdışı Mod', value: 'Tam Yerel Koruma Destekli' },
      tipHighlight: 'Tek tıkla JSON yedeği alabilir ve başka cihaza aktarabilirsiniz.'
    }
  }
];

export function InstructionModal({ isOpen, onClose, initialStep = 1 }: InstructionModalProps) {
  const [activeStep, setActiveStep] = useState<number>(initialStep);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'exam' | 'analysis' | 'admin'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'stepByStep' | 'roadmap'>('stepByStep');

  useEffect(() => {
    if (isOpen && initialStep) {
      setActiveStep(initialStep);
    }
  }, [isOpen, initialStep]);

  // Keyboard navigation (ESC, Left/Right arrows)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && viewMode === 'stepByStep') {
        setActiveStep(prev => Math.min(ALL_STEPS.length, prev + 1));
      } else if (e.key === 'ArrowLeft' && viewMode === 'stepByStep') {
        setActiveStep(prev => Math.max(1, prev - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, viewMode]);

  // Filtered steps based on category & search
  const filteredSteps = useMemo(() => {
    return ALL_STEPS.filter(s => {
      const matchCategory = selectedCategory === 'all' || s.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch = !q || 
        s.title.toLowerCase().includes(q) || 
        s.summary.toLowerCase().includes(q) || 
        s.stageName.toLowerCase().includes(q) || 
        s.tags.some(t => t.toLowerCase().includes(q)) || 
        s.keyPoints.some(kp => kp.toLowerCase().includes(q));
      return matchCategory && matchSearch;
    });
  }, [selectedCategory, searchQuery]);

  if (!isOpen) return null;

  const currentStep = ALL_STEPS.find(s => s.id === activeStep) || ALL_STEPS[0];
  const StepIcon = currentStep.icon;

  const handleNavigateToModule = (tabId?: string) => {
    if (!tabId) return;
    if (typeof window !== 'undefined' && (window as any).__navigateToTab) {
      (window as any).__navigateToTab(tabId);
    }
    onClose();
  };

  const progressPercent = Math.round((activeStep / ALL_STEPS.length) * 100);

  return (
    <div 
      className="fixed inset-0 z-[350] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-t-[28px] sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] relative animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 pb-safe sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* 1. Header (Premium Dark / Glassmorphism) */}
        <div className="bg-gradient-to-r from-slate-950 via-[#15161d] to-slate-950 text-white px-4 py-3.5 sm:px-6 sm:py-4 flex items-center justify-between gap-3 shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0 font-black">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 fill-current text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                  Nasıl Çalışır? • AkademiPanel Rehberi
                </h3>
                <span className="hidden sm:inline-block text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase tracking-wider">
                  9 Adım İş Akışı
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-white/60 font-medium line-clamp-1">
                Sınav planlamasından optik okumaya, kelebek salondan Akademi Arena ligine eksiksiz rehber.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* View Mode Switcher */}
            <div className="hidden sm:flex bg-white/10 p-0.5 rounded-xl border border-white/10 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('stepByStep')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'stepByStep' ? 'bg-amber-400 text-slate-950 shadow-xs' : 'text-white/70 hover:text-white'
                }`}
              >
                Adım Adım
              </button>
              <button
                type="button"
                onClick={() => setViewMode('roadmap')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'roadmap' ? 'bg-amber-400 text-slate-950 shadow-xs' : 'text-white/70 hover:text-white'
                }`}
              >
                Yol Haritası (Tümü)
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer active:scale-95"
              title="Kapat (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar (Interactive Mode) */}
        {viewMode === 'stepByStep' && (
          <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 shrink-0">
            <div 
              className="h-full bg-gradient-to-r from-amber-400 to-purple-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}

        {/* 2. Search Bar & Direct Quick Step Selector */}
        <div className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-3.5 py-2 sm:px-6 flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-700 dark:text-slate-200">
              📌 9 Adımda Eksiksiz Kurum İçi Sınav Akışı
            </span>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[140px] sm:max-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rehberde ara..."
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-7 py-1 text-xs text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-purple-500 font-medium"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 3. View Modes */}
        {viewMode === 'roadmap' ? (
          /* ========================================================
             ROADMAP / TIMELINE VIEW (All 9 Steps at a Glance)
             ======================================================== */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="text-center max-w-xl mx-auto mb-4">
              <h4 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Kurum İçi Sınav & Değerlendirme Yol Haritası
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Aşağıdaki 9 adımı takip ederek sınavlarınızı kusursuz şekilde yönetebilirsiniz.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredSteps.map((step) => {
                const SIcon = step.icon;
                return (
                  <div
                    key={step.id}
                    onClick={() => {
                      setActiveStep(step.id);
                      setViewMode('stepByStep');
                    }}
                    className="cursor-pointer bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 hover:border-purple-400 dark:hover:border-purple-500 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all active:scale-[0.99] flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${step.gradient} text-white flex items-center justify-center font-black text-xs shadow-2xs group-hover:scale-105 transition-transform`}>
                            {step.id}
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              {step.categoryLabel}
                            </span>
                            <h5 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-tight">
                              {step.stageName}
                            </h5>
                          </div>
                        </div>
                        <SIcon className="w-4 h-4 text-slate-400 group-hover:text-purple-600 transition-colors" />
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-2 leading-relaxed mb-3">
                        {step.summary}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-300">
                      <span>Detayları Oku →</span>
                      {step.targetTab && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNavigateToModule(step.targetTab);
                          }}
                          className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-purple-100 dark:hover:bg-purple-900/60 text-[10px] font-semibold text-slate-700 dark:text-slate-200 transition-colors"
                        >
                          Ekrana Git ↗
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ========================================================
             STEP-BY-STEP INTERACTIVE VIEW (Left Sidebar + Right Detail)
             ======================================================== */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* Sol Panel: Adım Listesi (Desktop Sidebar / Mobile Compact Horizontal Selector) */}
            <div className="md:w-[240px] lg:w-[260px] bg-slate-50 dark:bg-slate-900/80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-2 sm:p-3 overflow-x-auto md:overflow-y-auto flex md:flex-col gap-1.5 shrink-0 no-scrollbar">
              {filteredSteps.map((s) => {
                const isActive = s.id === activeStep;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveStep(s.id)}
                    className={`flex items-center gap-2 p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl text-xs font-bold transition-all cursor-pointer text-left shrink-0 md:w-full group ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                        : 'bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/80'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg sm:rounded-xl text-[11px] flex items-center justify-center font-black shrink-0 transition-transform group-hover:scale-105 ${
                      isActive ? 'bg-white text-purple-700 font-black' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}>
                      {s.id}
                    </div>
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="truncate text-xs font-black leading-tight flex items-center justify-between">
                        <span>{s.stageName}</span>
                        <ChevronRight className={`w-3.5 h-3.5 hidden md:block transition-transform ${isActive ? 'text-white' : 'text-slate-400 group-hover:translate-x-0.5'}`} />
                      </div>
                      <div className={`text-[10px] truncate mt-0.5 ${isActive ? 'text-purple-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        {s.categoryLabel}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Sağ Panel: Aktif Adım Detay Alanı */}
            <div className="flex-1 p-3 sm:p-5 md:p-6 overflow-y-auto flex flex-col gap-3 sm:gap-4 bg-white dark:bg-slate-900 custom-scrollbar">
              
              {/* Aşama Başlığı & Rozet & Ekrana Git Butonu */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3 sm:gap-3.5">
                  <div className={`p-3 sm:p-3.5 rounded-2xl bg-gradient-to-tr ${currentStep.gradient} text-white shrink-0 shadow-lg shadow-purple-500/10`}>
                    <StepIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${currentStep.tagColor}`}>
                        {currentStep.badge}
                      </span>
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                        {currentStep.categoryLabel}
                      </span>
                    </div>
                    <h4 className="text-base sm:text-xl font-black text-slate-900 dark:text-white tracking-tight mt-0.5">
                      {currentStep.title}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium mt-1 leading-relaxed">
                      {currentStep.summary}
                    </p>
                  </div>
                </div>

                {currentStep.targetTab && (
                  <button
                    type="button"
                    onClick={() => handleNavigateToModule(currentStep.targetTab)}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 dark:bg-purple-600 hover:bg-purple-600 dark:hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0 self-start sm:self-center active:scale-95 group w-full sm:w-auto"
                    title="Bu ekrana hemen git"
                  >
                    <span>{currentStep.stageName} Ekranını Aç</span>
                    <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                )}
              </div>

              {/* Özellik Etiketleri */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Öne Çıkanlar:
                </span>
                {currentStep.tags.map((tag, idx) => (
                  <span 
                    key={idx} 
                    className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 flex items-center gap-1 shadow-2xs"
                  >
                    <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                    <span>{tag}</span>
                  </span>
                ))}
              </div>

              {/* Adım Maddeleri Kartı */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-3.5 sm:p-4 flex flex-col gap-2.5">
                <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MousePointerClick className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Nasıl Uygulanır & Süreç:</span>
                </div>
                {currentStep.keyPoints.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                    <div className="w-4.5 h-4.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <span>{point}</span>
                  </div>
                ))}
              </div>

              {/* İki Mini Kart: Öne Çıkan İstatistik & Püf Noktası */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {currentStep.mockData && (
                  <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{currentStep.mockData.stat1.label}</span>
                      <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">{currentStep.mockData.stat1.value}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{currentStep.mockData.stat2.label}</span>
                      <p className="text-xs sm:text-sm font-black text-purple-700 dark:text-purple-300 mt-0.5">{currentStep.mockData.stat2.value}</p>
                    </div>
                  </div>
                )}

                {/* Öğretmen & Yönetici İpuçları Kutusu */}
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/90 dark:border-amber-800/50 rounded-2xl p-3 flex items-start gap-2.5">
                  <div className="p-1 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 shrink-0">
                    <Lightbulb className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-xs text-amber-950 dark:text-amber-200 leading-relaxed">
                    <strong className="font-black text-amber-900 dark:text-amber-300">Önemli İpucu:</strong>{' '}
                    {currentStep.proTip}
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* 4. Footer Actions (Gezinme Butonları) */}
        <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-3 px-4 sm:px-6 flex items-center justify-between gap-2 shrink-0">
          {viewMode === 'stepByStep' ? (
            <>
              <button
                type="button"
                onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
                disabled={activeStep === 1}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Önceki Adım</span>
                <span className="sm:hidden">Önceki</span>
              </button>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">
                  Adım <strong className="text-slate-800 dark:text-white">{activeStep}</strong> / {ALL_STEPS.length}
                </span>
              </div>

              {activeStep < ALL_STEPS.length ? (
                <button
                  type="button"
                  onClick={() => setActiveStep(prev => Math.min(ALL_STEPS.length, prev + 1))}
                  className="flex items-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all cursor-pointer active:scale-95"
                >
                  <span>Sonraki Adım</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center gap-1.5 px-4 sm:px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Başlayalım!</span>
                </button>
              )}
            </>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">9 Adımlı Kurum İçi Optik Deneme Süreci</span>
              <button
                type="button"
                onClick={() => setViewMode('stepByStep')}
                className="px-4 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-purple-500"
              >
                Adım Adım İncele ➔
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default InstructionModal;
