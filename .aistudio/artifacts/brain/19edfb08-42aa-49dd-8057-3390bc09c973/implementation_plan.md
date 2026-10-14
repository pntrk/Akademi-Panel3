# Optik Tarama Motoru Boş Soru ve Sahte İşaretleme (False Positive) Önleme Planı

Kurum içi çok dersli sınavlarda ve düz yataklı/beslemeli tarayıcılardan (Scanner/ADF) alınan optik formlarda boş bırakılan soruların rastgele şıklar olarak algılanması problemini çözen; baloncuk çekirdek alanı örneklemesi, basılı glif/çember filtresi, medyan arka plan kalibrasyonu ve mutlak grafit doğrulama mimarisini içeren iyileştirme planı.

## User Review & Critical Decisions

> [!IMPORTANT]
> Kullanıcı ile yapılan soru-cevap neticesinde belirlenen temel parametreler:
> - **Hata Karakteristiği**: Boş bırakılan sorular tek bir harf (örn. A) yerine satırdaki baskı veya tarama gürültüsüne bağlı olarak **rastgele şıklar** (A, B, C, D, E) olarak algılanmaktadır.
> - **Çözüm Yaklaşımı**: Boş soruların yanlış okunmasını önlemek için **minimum doluluk eşiğini artırma ve bağıl kontrast kontrolü** esas alınacaktır.
> - **Görsel Kaynağı**: Formlar ağırlıklı olarak **düz yataklı veya beslemeli tarayıcılardan (Flatbed / ADF Scanner)** alınan yüksek netlikteki PDF veya resim dosyalarıdır.

- **Onaylanan Karar 1**: Baloncuk örnekleme yarıçapı çember dış çizgisine basmayacak şekilde çekirdek odaklı (%72) olarak daraltılacak, böylece basılı harf (A-B-C-D-E) ve çember çizgisi kaynaklı yalancı doluluk (false positive) tamamen elenecektir.
- **Onaylanan Karar 2**: Arka plan koyuluğunda `Math.min` yerine medyan/ortalama kullanılarak kağıt dokusu veya tarayıcı zemin tonu yapay olarak grafit gibi hesaplanmayacaktır.
- **Onaylanan Karar 3**: Bir satırdaki tüm şıklar için "Mutlak Grafit Eşiği" (Absolute Graphite Threshold) kontrolü getirilecek; çekirdek doluluk ve koyuluğu kurşun kalem yoğunluğunu karşılamayan sorular kesin olarak boş kabul edilecektir.

---

## 1. Overview & Core Concept

- **Problem**: Düz yataklı veya beslemeli tarayıcılardan taranan optik formlarda, optik formun üzerindeki basılı baloncuk çerçevesi ve baloncuk içindeki basılı harf fontu (A, B, C, D, E) yüksek kontrastlıdır. Boş bırakılan bir soruda tüm şıklar boş olsa dahi, arama penceresi baloncuk kenarına kaydığında veya bir şıktaki baskı diğerinden 1-2 piksel daha kalın olduğunda, bağıl kontrast farkı oluşarak o şıkkı işaretlenmiş sanmaktadır.
- **Çözüm**:
  1. **Çekirdek Bölge Örneklemesi (Core Bubble Sampling)**: Örnekleme alanı baloncuk yarıçapının %72'si ile sınırlandırılarak dış siyah çember hattı örnekleme dışı bırakılır.
  2. **Basılı Font / Çember Ayıklama Filtresi**: Boş baloncuğun basılı harf vuruşları (stroke) dar ve incedir; gerçek kurşun kalem ise baloncuk merkezini homojen doldurur. Doluluk alanı en az %30 ve çekirdek koyuluğu en az 16 birim olmayan şıklar doğrudan elenir.
  3. **Satır Düzeyinde Mutlak Grafit Eşiği**: Bir soruda en yüksek puan alan şık dahi olsa, mutlak grafit varlığı kanıtlanmamışsa soru kesinlikle "Boş" (`""`) olarak işaretlenir.
  4. **Güvenli Arka Plan Medyanı**: Satır içi beyazlık örneklerinin en düşüğü yerine güvenilir medyanı alınarak yapay bağıl kontrast sıçramaları önlenir.

---

## 2. User Experience & Visual Design

- **Görsel Geri Bildirim**:
  - Taranan form üzerinde gerçekten kurşun kalemle işaretlenmiş sorular yeşil odak dairesiyle vurgulanır.
  - Boş bırakılan sorular için hiçbir şıkkın üzerine sahte lazer/odak noktası konulmaz; soru temiz ve boş olarak gösterilir.
  - Kullanıcı tarama önizleme kartında ve sonuç listesinde boş soruları net bir gri tire (`-`) veya `Boş` etiketiyle görür.
- **Doğruluk ve Kararlılık**:
  - 90 veya 120 soruluk sınavlarda tümü A kodlanmış test kağıdında, yalnızca işaretlenen A şıkları okunur; işaretlenmemiş bırakılan tüm ders veya sorular %0 hata payıyla boş kalır.

---

## 3. Key Product Decisions & Trade-Offs

- **Karar 1: Örnekleme Yarıçapının %88'den %72'ye Çekilmesi**
  - *Gerekçe*: %88 yarıçap baloncuk çeperine temas etmekte ve basılı çember çizgisini "koyuluk" olarak saymaktadır. %72 yarıçap ise çember çizgisinden tamamen yalıtılmış olup sadece kurşun kalem karalamasını hedefler.
  - *Alternatif*: Çemberi silmek için morfolojik filtreleme yapmak CPU'yu yavaşlatacağı için saf geometrik çekirdek alanı seçilmiştir.
- **Karar 2: Mutlak Grafit Eşiği (Absolute Graphite Threshold)**
  - *Gerekçe*: Bağıl fark (lead/diff) tek başına yanıltıcıdır; 5 şıkkın hepsi boşken biri baskı hatasından ötürü diğerlerinden 3 puan yüksek olabilir. Mutlak grafit eşiği, en az bir şıkkın gerçek kurşun kalem yoğunluğuna (belirli bir minimum doluluk ve merkez koyuluğuna) sahip olmasını zorunlu kılar.
- **Karar 3: Arka Plan Örneklemesinde Medyan Hesaplama**
  - *Gerekçe*: `Math.min` kağıdın en beyaz noktasını (örneğin kenar boşluğu) baz alarak baloncuk kolonundaki hafif tarayıcı grileşmesini sahte sinyale dönüştürüyordu. Satır içi medyan kağıdın gerçek tonunu yansıtır.

---

## 4. Technical Architecture & Data Strategy

### Mimari Akış Şeması

```
┌─────────────────────────────────────────────────────────┐
│              Optik Form Görüntüsü (PDF / Resim)          │
└───────────────────────────┬─────────────────────────────┘
                            │ Homografi & Perspektif Düzeltme
                            ▼
┌─────────────────────────────────────────────────────────┐
│        Soru Satırı & Baloncuk Koordinatları (A..E)      │
└───────────────────────────┬─────────────────────────────┘
                            │
       ┌────────────────────┴────────────────────┐
       ▼                                         ▼
┌───────────────────────────────┐ ┌───────────────────────────────┐
│  Medyan Arka Plan Analizi     │ │ Çekirdek Alanı Örnekleme     │
│  (Satır içi şıklar arası)     │ │ (R = R_bubble * 0.72)         │
└──────────────┬────────────────┘ └──────────────┬────────────────┘
               └────────────────────┬────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│     Baloncuk Metrikleri (CoreDarkness, FillRatio, HeavyRatio)   │
└───────────────────────────────────┬─────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Mutlak Grafit Kontrolü (Gate)                   │
│  - En yüksek şık (Best) mutlak grafit eşiğini aşıyor mu?        │
│  - FillRatio >= %30 VE CoreDarkness >= 16 VE HeavyRatio >= %8?  │
└─────────────────┬─────────────────────────────┬─────────────────┘
                  │ EVET                        │ HAYIR
                  ▼                             ▼
┌───────────────────────────────────┐ ┌───────────────────────────┐
│     Bağıl Kontrast Doğrulaması    │ │       BOŞ SORU ("")       │
│  (Lead >= 4.0, İkinci şık silgi   │ │ (Hiçbir şık işaretli     │
│   ise geçerli, çift ise geçersiz) │ │  sayılmaz, gürültü yok)   │
└─────────────────┬─────────────────┘ └───────────────────────────┘
                  │
                  ▼
┌───────────────────────────────────┐
│    Nihai Cevap (A, B, C, D veya E)│
└───────────────────────────────────┘
```

### Kod Düzeyinde Değişecek Fonksiyonlar
1. `src/lib/omrEngine.ts`:
   - `evaluateBubbleFill`: Örnekleme yarıçapını çember çizgisine çarpmayacak `0.72 * bubbleRadiusPx` değerine çekme; `darkThresh` ve `heavyThresh` değerlerini tarayıcı kağıt gürültüsüne karşı optimize etme.
   - `evaluateQuestionAnswer`:
     - Arka plan için `Math.min` yerine medyan hesabı.
     - Mutlak Grafit Eşiği (Absolute Graphite Threshold): En iyi şık dahi olsa minimum kurşun kalem doluluğu ve çekirdek yoğunluğu taşımıyorsa soruyu anında boş (`""`) kabul etme.
     - Sahte işaretleme ve basılı glif elenmesi.

### Doğrulama ve Test Adımları
- Tümü "A" işaretlenmiş ve geri kalan soruları boş bırakılmış test formunda:
  1. A işaretlenen tüm soruların eksiksiz algılandığı doğrulanacak.
  2. Boş bırakılan soruların hiçbirinde rastgele şık algılanmadığı, hepsinin temiz boş çıktığı doğrulanacak.
  3. Çift işaretleme ve silgi ayrımının korunduğu doğrulanacak.
  4. Uygulama TypeScript derlemesi (`compile_applet`) hatasız tamamlanacak.
