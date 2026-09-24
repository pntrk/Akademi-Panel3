import React, { useState } from 'react';
import { 
  X, 
  HelpCircle, 
  Printer, 
  Camera, 
  KeyRound, 
  FileSpreadsheet, 
  Trophy, 
  CheckCircle2, 
  Sparkles, 
  QrCode, 
  Smartphone, 
  Lightbulb, 
  ArrowRight,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface OmrQuickGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    step: 1,
    badge: '1. Aşama',
    title: 'Sınav Şablonu ve Dersleri Belirleyin',
    icon: Sparkles,
    color: 'from-blue-600 to-indigo-600',
    iconBg: 'bg-blue-100 text-blue-700',
    description: 'Okulunuzda uygulayacağınız denemenin ders dağılımını yapılandırın.',
    details: [
      'LGS (90 Soru), Ortaokul 5-7 (75 Soru), TYT (120 Soru) veya Tek Branş (20 Soru) hazır şablonlarından birini seçin.',
      'Dilerseniz yeni dersler ekleyebilir veya soru sayılarını sınavınıza göre özelleştirebilirsiniz.',
      'Seçenek sayısını (4 şık / 5 şık) ve yanlış götürme kuralını belirleyip "Şablonu Kaydet" butonuna basın.'
    ]
  },
  {
    step: 2,
    badge: '2. Aşama',
    title: 'Cevap Anahtarlarını Tanımlayın',
    icon: KeyRound,
    color: 'from-purple-600 to-violet-600',
    iconBg: 'bg-purple-100 text-purple-700',
    description: 'A, B, C ve D kitapçıklarının doğru şıklarını sisteme aktarın.',
    details: [
      'Ders bazında kabarcıklara tıklayarak veya klavyenizden (A, B, C, D, E) seri tuşlayarak cevapları girin.',
      'Hızlı Metin Yapıştırma aracına "1-A 2-B 3-C..." veya doğrudan "ABCDDCBA..." şeklinde yapıştırarak saniyeler içinde tüm anahtarı doldurun.',
      'A Kitapçığından B Kitapçığına tek tıkla kopyalama özelliğini kullanabilirsiniz.'
    ]
  },
  {
    step: 3,
    badge: '3. Aşama',
    title: 'Karekodlu A4 Optik Formları Basın',
    icon: Printer,
    color: 'from-emerald-600 to-teal-600',
    iconBg: 'bg-emerald-100 text-emerald-700',
    description: 'Her öğrenciye özel adı, numarası ve QR kodu basılı A4 form üretin.',
    details: [
      'Sınıf/Şube filtresinden istediğiniz sınıfı (örn: 8/A) veya "Tüm Okul"u seçin.',
      '"🔴 Kırmızı Optik" veya toner tasarruflu "⚫ Siyah-Beyaz" baskı modunu belirleyin.',
      '"Toplu Form Yazdır / PDF İndir" butonuna basarak tüm öğrencilerin formlarını tek seferde yazıcıya gönderin veya PDF olarak indirin.',
      'Öğrenciler sınav esnasında yalnızca kendi adlarının yazılı olduğu formun kitapçık türünü kodlar ve soruları işaretler.'
    ]
  },
  {
    step: 4,
    badge: '4. Aşama',
    title: 'Canlı Kamera veya Toplu Dosya ile Okutun',
    icon: Camera,
    color: 'from-amber-500 to-orange-600',
    iconBg: 'bg-amber-100 text-amber-800',
    description: 'Akıllı OptikAI motoru ile kağıtları saniyeler içinde okutun.',
    details: [
      'Telefonunuzun veya bilgisayarınızın kamerasını kağıdın 4 köşesindeki siyah kareleri görecek şekilde tutun.',
      'Sistem kağıttaki QR koddan öğrencinin numarasını ve kodlanan kitapçığı anında tanır; hiçbir manuel öğrenci seçimine gerek kalmaz.',
      'Dilerseniz fotokopi/tarayıcıdan aldığınız toplu PDF veya fotoğraf dosyalarını sürükleyip bırakarak toplu okutabilirsiniz.'
    ]
  },
  {
    step: 5,
    badge: '5. Aşama',
    title: 'Sonuçlar, Karneler ve Lig Puanları',
    icon: Trophy,
    color: 'from-rose-600 to-pink-600',
    iconBg: 'bg-rose-100 text-rose-700',
    description: 'Tüm sonuçlar, çeldirici analizleri ve puanlar otomatik güncellenir.',
    details: [
      '"Sonuçlar & Analiz" ekranında öğrencilerin netleri, puanları ve renkli bireysel karneleri anında hazırdır.',
      '"Soru & Madde Analizi" sekmesinden hangi sorunun ne kadar zor olduğunu ve öğrencilerin hangi çeldiriciye takıldığını görün.',
      'Öğrencilerin Lig Puanları (LP), takımları (Kutup Yıldızları, Sıçrama Ustaları, Taktik Avcıları) ve başarı rozetleri Akademi Arena’da anında aktifleşir.'
    ]
  }
];

export function OmrQuickGuideModal({ isOpen, onClose }: OmrQuickGuideModalProps) {
  const [activeStep, setActiveStep] = useState<number>(1);

  if (!isOpen) return null;

  const currentStepData = STEPS.find(s => s.step === activeStep) || STEPS[0];
  const StepIcon = currentStepData.icon;

  return (
    <div className="fixed inset-0 z-[300] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Üst Modal Başlığı */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white p-5 sm:p-6 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight">
                  Kurum İçi Optik Deneme İş Akışı Rehberi
                </h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  HIZLI BAŞLANGIÇ
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Şablondan form basımına, canlı kamera taramasından Akademi Arena ligine 5 adımda tam süreç.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5 Adımlı Navigasyon Çubuğu */}
        <div className="grid grid-cols-5 bg-slate-50 border-b border-slate-200 p-2 gap-1.5 shrink-0 overflow-x-auto">
          {STEPS.map(s => {
            const SIcon = s.icon;
            const isActive = s.step === activeStep;
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => setActiveStep(s.step)}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/80'
                }`}
              >
                <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-black ${
                  isActive ? 'bg-white text-purple-700' : 'bg-slate-200 text-slate-700'
                }`}>
                  {s.step}
                </span>
                <span className="hidden md:inline truncate">{s.badge}</span>
              </button>
            );
          })}
        </div>

        {/* Adım İçerik Alanı */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 flex flex-col gap-6">
          
          {/* Adım Başlığı & Rozet */}
          <div className="flex items-start gap-4">
            <div className={`p-3.5 rounded-2xl ${currentStepData.iconBg} shrink-0 shadow-xs`}>
              <StepIcon className="w-7 h-7" />
            </div>
            <div>
              <div className="text-xs font-black text-purple-600 uppercase tracking-wider">
                {currentStepData.badge}
              </div>
              <h4 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
                {currentStepData.title}
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
                {currentStepData.description}
              </p>
            </div>
          </div>

          {/* Adım Maddeleri */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
            {currentStepData.details.map((detail, idx) => (
              <div key={idx} className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{detail}</span>
              </div>
            ))}
          </div>

          {/* İpuçları Kutusu */}
          <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 leading-relaxed">
              <strong className="font-bold">Öğretmenler İçin İpucu:</strong>{' '}
              {activeStep === 1 && 'Sınavın soru sayısı ve ders dağılımı değiştiğinde sistem cevap anahtarı kabarcıklarını ve optik form sütunlarını otomatik yeniden boyutlandırır.'}
              {activeStep === 2 && 'Cevap anahtarını girdikten sonra üstteki "Şablonu ve Dersleri Kaydet" butonuna basarak değişiklikleri Firestore veritabanına sabitlemeyi unutmayınız.'}
              {activeStep === 3 && 'Her öğrenci için üretilen QR kod; optik taramada kağıdın hangi öğrenciye ait olduğunu 0.1 saniyede otomatik belirler ve yanlış kodlama riskini sıfırlar.'}
              {activeStep === 4 && 'Optik taramada telefonunuzu kağıda paralel tutmanız ve 4 köşedeki siyah karelerin kamera çerçevesi içinde kalması yeterlidir.'}
              {activeStep === 5 && 'Kurum içi optik deneme sonuçları ile dışarıdan Excel ile yüklenen yayıncı denemeleri aynı öğrenci karnelerinde ve aynı Akademi Arena lig puanı tablosunda birleşir.'}
            </div>
          </div>

        </div>

        {/* Modal Alt Gezinme Barı */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveStep(prev => Math.max(1, prev - 1))}
            disabled={activeStep === 1}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-40 transition-all cursor-pointer"
          >
            ← Önceki Adım
          </button>

          <div className="text-xs font-bold text-slate-400">
            Adım {activeStep} / {STEPS.length}
          </div>

          {activeStep < STEPS.length ? (
            <button
              type="button"
              onClick={() => setActiveStep(prev => Math.min(STEPS.length, prev + 1))}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-500/20 transition-all cursor-pointer"
            >
              <span>Sonraki Adım</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Anladım, Başla!</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
