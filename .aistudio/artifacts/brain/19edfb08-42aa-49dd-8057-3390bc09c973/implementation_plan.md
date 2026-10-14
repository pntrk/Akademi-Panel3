# Optik Tarama Motoru İyileştirme ve Dinamik Kontrast Kalibrasyon Planı

Kurum içi çok dersli LGS ve TYT formatındaki sınavlarda (90-120 soru) tüm cevapları "A" olarak doldurulmuş test optiklerinde bazı soruların boş/okunmamış olarak algılanması sorununu kökten çözen; baloncuk arama penceresi toleransını, dinamik kontrast kalibrasyonunu ve arka plan örnekleme mimarisini güçlendiren kapsamlı iyileştirme planı.

## Kullanıcı Tercihleri ve Tespit Edilen Kritik Kararlar

> [!IMPORTANT]
> Kullanıcı ile yapılan netleştirme görüşmesinde aşağıdaki yönelimler doğrulanmıştır:
> - **Sorun Belirtisi**: Eşleşmeyen sorular tarama ekranında **boş veya okunmamış** olarak algılanmaktadır (işaretin varlığına rağmen eşik altına düşmektedir).
> - **Sınav Yapısı**: LGS veya TYT formatında çok dersli, 4 sütunlu, **90 veya 120 soruluk** yoğun optik form.
> - **Öncelikli Odak**: **Baloncuk kontrast toleransı ve dinamik eşik kalibrasyonu**.

---

### 1. Temel Sorun Analizi & Kök Nedenler (Root Causes)

Yapılan derin kod ve algoritma incelemesinde tespit edilen 4 kritik teknik kök neden:

1. **Aşırı Dar Merkez Kaydırma Arama Penceresi (Micro Offset)**:
   - Yoğun 90-120 soruluk formlarda (özellikle 3. ve 4. sütunlarda ve alt satırlarda) telefon kamerası lens distorsiyonu veya kağıt eğimi nedeniyle baloncuk merkezleri 4 köşe çapa dönüşümünden 3-6 piksel sapabilmektedir.
   - Mevcut motorda arama toleransı maksimum 1-2 piksel ile sınırlandırılmıştır (`Math.min(2, ...)`). Baloncuk hafif saptığında örnekleme çemberi beyaz kağıda taşmakta, doluluk oranı yapay olarak %25'in altına düşmektedir.

2. **Bitişik Satır Arka Plan Örnekleme Kirlenmesi (Neighbor Row Contamination)**:
   - Mevcut arka plan örnekleyici, soru satırının üst ve altından 2.8 mm mesafeden örnek almaktadır.
   - Soru satır aralığı 4.65 mm olduğundan, 2.8 mm'lik örnek tam bir önceki veya sonraki satırın baloncuk sınırına basmaktadır.
   - Tüm sorular "A" işaretlendiğinde, N. sorunun arka planını örnekleyen nokta N-1. sorunun grafit karalamasına denk gelerek yerel kağıt karanlığını yapay olarak yükseltmekte ve N. sorunun göreli kontrastını yok etmektedir.

3. **Katı İkili Eşikler ve Boş Şık Glif Karışıklığı**:
   - `meetsAbsoluteMarkThreshold` ve `meetsContrastThreshold` katı sınır değerler (12.0 puan, 15.0 koyuluk, %30 doluluk) kullanmaktadır.
   - Açık tonlu HB kurşun kalemle doldurulmuş veya optik form matbaa baskısında harf glifi (A, B, C, D) belirgin olan kağıtlarda, "A" şıkkı ile diğer şıklar arasındaki fark katı oranın (1.85x) veya katı puanın milimetrik altında kaldığında soru doğrudan "BOŞ" kabul edilmektedir.

4. **Kayıp Satır Hizalama Sensörü (Unused TrueRowY)**:
   - Görseldeki cetvel/satır işaretçilerini takip eden `getTrueRowY` fonksiyonu tanımlanmış olmasına rağmen soru döngüsüne entegre edilmemiştir; homografi matrisi tek başına kullanıldığında optik eğrilikler düzeltilememektedir.

---

### 2. İyileştirme Çözüm Mimarisi & Veri Akışı

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OPTİK TARAMA İYİLEŞTİRME MİMARİSİ                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. ADAPTİF ÇİFT GEÇİŞLİ ARAMA (Two-Pass Multi-Scale Bubble Center Finder)   │
│    - 1. Geçiş: Genişletilmiş ±5px arama penceresi ile merkez bulma          │
│    - 2. Geçiş: Baloncuk çekirdeği (%40) ve iç halka (%65) ağırlıklı tarama  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. AKILLI ARKA PLAN VE KONTRAST İZOLASYONU                                  │
│    - Bitişik soru sıralarından arındırılmış güvenli yatay örnekleme         │
│    - Her soru için satır içi medyan kağıt beyazlığı kalibrasyonu            │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. DİNAMİK EŞİK VE HB KALEM ADAPTASYONU (Dynamic Document Baseline)         │
│    - Form genelindeki belirgin işaretlemelerden öğrenilen grafit profili    │
│    - Şıklar arası Göreli Z-Skor ve Kontrast Oranı (Fark Eşiği: 3.5 -> 2.5)  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. TEŞHİS VE CANLI ÖNİZLEME (Diagnostic Visual Feedback)                    │
│    - Tarama ekranında şüpheli/düşük kontrastlı soruları renklendirme         │
│    - Baloncuk koordinat lazer çizgilerinde kesin merkezleme göstergesi      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 3. Yapılacak Teknik Değişiklikler ve Adımlar

#### Adım 1: Güvenli ve Bitişik Satırdan Arındırılmış Arka Plan Örnekleme (`sampleLocalBackground`)
- `evaluateQuestionAnswer` içinde soru satırının üst/alt dikey aralığındaki örnekleme yarıçapı, satır yüksekliğinin güvenli orta noktasına (`±1.6 mm`) çekilecek; bitişik soruların işaretlenmiş baloncuklarına basması engellenecek.
- Yatayda şıklar arasındaki net beyaz boşluklardan (`A-B`, `B-C`, `C-D` arası) 3 nokta ve sütun kenarından 1 nokta olmak üzere saf kağıt beyazlığı hesaplanacak.

#### Adım 2: Çift Kademeli Dinamik Baloncuk Örnekleme (`evaluateBubbleFill`)
- Arama penceresi (`maxOffset`), `scalePxPerMm` değerine bağlı olarak dinamik şekilde `Math.round(bubbleRadiusPx * 0.38)` (ortalama 4-5 piksel) seviyesine yükseltilecek.
- Baloncuk çekirdeği analizi çift katmanlı hale getirilecek:
  - İç Çekirdek (Yarıçapın %40'ı): Harf glifinden etkilenmeyen saf grafit yoğunluğu.
  - Dış Halka (Yarıçapın %65'i): Çember çizgisi taşmalarını filtreleyen doldurma doğrulaması.
- Boş şık glifi filtresi optimize edilecek: İnce harf çizgileri ile homojen grafit lekesi arasındaki varyans/standart sapma analiziyle silik kurşun kalemler kurtarılacak.

#### Adım 3: Çok Dersli 90-120 Soru Formları İçin Göreli Kontrast Kalibrasyonu
- `meetsAbsoluteMarkThreshold`:
  - En yüksek puanlı şıkkın skoru için minimum taban 12.0'den 8.5'e uyarlanacak; ancak diğer 3-4 şıkka göre farkı (`scoreDiff >= 4.0` veya `scoreRatio >= 1.55`) gözetilerek yanlış pozitif üretilmeyecek.
- Tümü "A" işaretlenen serilerde (veya ardışık aynı şık işaretlemelerinde) satır satır birbirini nötrleme riski tamamen ortadan kaldırılacak.

#### Adım 4: Canlı Tarama ve Toplu Okuma Entegrasyonu (`ScanView.tsx`)
- `processSinglePageDirect` ve canlı kamera döngüsündeki `processImage` fonksiyonları güncellenmiş OMR motoru ile tam senkron çalışacak şekilde bağlanacak.
- Taranan formda okunan her sorunun güven skoru (confidence score) hesaplanacak; şüpheli sınırda kalan sorular tarama özetinde kullanıcıya açıkça raporlanacak.

---

### 4. Doğrulama ve Test Senaryoları

1. **Tümü "A" İşaretli Test Formu Doğrulaması**:
   - 90 soruluk LGS ve 120 soruluk TYT formlarında tüm soruların istisnasız A olarak algılandığı, hiçbir sorunun boş kalmadığı test edilecek.
2. **Boş Form / Hayalet İşaretleme Doğrulaması**:
   - Hiçbir işaret konulmamış optik formda basılı matbaa harflerinin (A, B, C, D) yanlışlıkla işaretli algılanmadığı (`0 doğru, 0 yanlış, tümü boş`) teyit edilecek.
3. **Silik / Açık Renk Kurşun Kalem Testi**:
   - Düşük kontrastlı veya silik işaretlemelerin yüksek kontrastlı arka plan gürültüsü içinde doğru şekilde ayrıştırıldığı doğrulanacak.
4. **Kod Tabanı Derleme ve Lint Doğrulaması**:
   - `compile_applet` ve `lint_applet` çalıştırılarak sıfır hata ile tamamlandığı kontrol edilecek.
