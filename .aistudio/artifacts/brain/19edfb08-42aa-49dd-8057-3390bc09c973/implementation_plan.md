# OptikAI OMR Tarama Motoru ve Form Harita Entegrasyon Planı (Kurum İçi Sınavlar)

Bu plan, daha önce **OptikAI** uygulamasında kusursuz çalışan OMR tarama motorunun, satır hizalama (`getTrueRowY`), baloncuk matrisi ve karekod eşleme yeteneklerinin **Akademipanel3** sistemine, özellikle **kurum içi deneme sınavları** için entegre edilmesini amaçlar.

---

## Kullanıcı Tercihleri & Karar Özeti
Kullanıcı ile mutabık kalınan mimari parametreler:
1. **Motor Kapsamı:** Sadece **kurum içi deneme sınavlarına** özel motor olarak çalışacak; harici/yayıncı sınavlarının mevcut esnek yapısı korunacaktır.
2. **Karar Kuralı:** OptikAI eşik kuralı (`maxD >= 40` ve şıklar arası `diff >= 15`) temel alınacak; boş soruları koruyan grafit kontrolü ile desteklenecektir.
3. **Öğrenci & Kitapçık Eşleme:** **Karekod öncelikli**, karekod okunamazsa form üzerindeki **optik numara ve kitapçık kodlaması** devreye girecektir.

---

## 1. Mimari Analiz ve OptikAI Entegrasyon Noktaları

### A. OptikAI Karar Kuralı (`maxD >= 40` & `diff >= 15`)
OptikAI motorunda baloncuk koyuluğu `(255 - Math.max(R, G, B))` formülü ile 0-255 aralığında hesaplanır.
- **İşaretli Şık:** En koyu şıkkın `maxD >= 40.0` olması ve ikinci en koyu şıktan en az `15.0` puan daha koyu (`diff >= 15.0`) olması gerekir.
- **Çift İşaretleme (Geçersiz):** Hem en koyu hem ikinci şık `maxD >= 40.0` ve aralarındaki fark `diff < 15.0` ise soru çift işaretli (`X` veya `ÇİFT`) olarak işaretlenir.
- **Boş Soru:** En yüksek şık dahi `maxD < 40.0` ise soru kesin olarak **boş** (`""`) kabul edilir; silinti, harf baskısı veya kağıt dokusu asla işaretli sayılamaz.
- **Grafit Çekirdek Güvencesi:** Çekirdek yarıçapı baskı çemberine taşmayacak şekilde filtrelenerek yüksek netlik sağlanır.

### B. Satır Hizalama (`getTrueRowY`)
Yatayda veya dikeyde tarayıcı/kamera beslemesinden kaynaklanan milimetrik eğilmeler için:
- Sol kenar referans veya soru numarası hizasında `applyHomography` ile hesaplanan Y koordinatı etrafında dikey $\pm 15$ piksel tarama yapılır.
- Satırın gerçek merkez koyuluğu tespit edilerek baloncuklar gerçek satır Y koordinatına (`bestY`) kilitlenir.

### C. Hiyerarşik Öğrenci & Kitapçık Tespiti
1. **Karekod (QR Code) Önceliği:**
   - Sayfa köşeleri kilitlendikten sonra homografi ile düzeltilmiş QR kod alanı `scanQRWithHomography` ve `scanQRRobustly` ile taranır.
   - QR'dan gelen `E` (Sınav ID), `N` (Öğrenci No) ve `B` (Kitapçık) bilgisi anında sınav ve öğrenci kütüğüyle eşleştirilir.
2. **Optik Yedekleme (Fallback):**
   - QR yoksa veya hasarlıysa, formun üst bilgi bloğundaki optik alanlar taranır:
     - Kitapçık türü: `bookletPositions` (A, B, C, D) baloncukları OptikAI kuralıyla okunur.
     - Öğrenci No: 5 sütunluk numara kodlama matrisi sütun bazında `maxD >= 40` kuralıyla okunarak öğrenci numarası oluşturulur ve merkezi öğrenci listesinden öğrenci bulunur.

---

## 2. Değişiklik Yapılacak Dosyalar ve Planlanan Geliştirmeler

### 1. `src/lib/omrEngine.ts`
- **`evaluateQuestionAnswerOptikAI` Fonksiyonu:**
  - Kurum içi deneme sınavları için optimize edilmiş, `maxD >= 40` ve `diff >= 15` kuralını uygulayan özel değerlendirme fonksiyonu ekleme.
  - Soru şıklarının homografi ve satır kayması düzeltmesiyle çekirdek koyuluklarını çıkarma.
  - Şık puanları, farklar, güven endeksi ve çift işaretleme durumunu döndürme.
- **`evaluateBubbleOptikAI` Fonksiyonu:**
  - Hızlı piksel analizi (whiteness tersi) ve çekirdek koyuluk ortalaması.
- **`isInternalExam` Yardımcı Kontrolü:**
  - Sınavın kurum içi deneme sınavı olup olmadığını (`examType === 'internal'` veya `omrMap` sahibi olan sınavlar) tespit etme.

### 2. `src/views/ScanView.tsx`
- **Tarama Motoru Yönlendirmesi (Routing):**
  - Hem `readForm` (canlı/tekli tarama) hem de `processSinglePageDirect` (toplu/PDF dosya tarama) akışlarında sınav türüne bakarak:
    - Kurum içi deneme sınavlarında `evaluateQuestionAnswerOptikAI` motorunu devreye alma.
    - Satır bazında `getTrueRowY` hizalamasını kullanarak baloncuk koordinatlarını satırın gerçek optik hizasına eşitleme.
  - Karekod önceliğini ve karekod bulunamadığında optik numara/kitapçık okuma sırasını güçlendirme.
- **Görsel Durum & Lazer İşaretleri:**
  - Kurum içi optik motorunun tespit ettiği işaretleme merkezlerini tam isabetle (`laserMarks`) ekrana çizdirme.
  - Arayüzde "OptikAI Kurum İçi Motoru Aktif" durum rozeti gösterimi.

### 3. `src/views/KeysAndPrintView.tsx` (İhtiyaç Halinde)
- Yazdırılan kurum içi optik formların `generateExamOmrMap` koordinatları ile OMR motorunun okuduğu koordinatların milimetrik uyumunu doğrulama.

---

## 3. Doğrulama ve Test Planı

1. **Birim / Fonksiyonel Testler:**
   - Boş bırakılan soruların `maxD < 40` kuralı sayesinde kesinlikle boş (`""`) kalması.
   - Tüm şıkları A işaretlenmiş 90 veya 120 soruluk sınavda tüm soruların eksiksiz ve firesiz "A" olarak okunması.
   - Çift işaretli sorularda (`diff < 15` ve her ikisi de koyu) sistemin bunu çift işaretli olarak kaydetmesi veya puanlamaması.
   - Karekodlu formda öğrencinin anında eşleşmesi; karekodsuz formda optik numaranın kütükten öğrenciyi bulması.
2. **Derleme ve Kod Standartları Doğrulaması:**
   - `compile_applet` ile TypeScript ve Vite üretim derlemesinin hatasız tamamlanması.
   - `lint_applet` ile sıfır hata doğrulaması.
