# Ferah OMR Şablon Tasarımı ve Dinamik Optik Harita Optimizasyonu

Kullanıcının optik form şablonunda sorular ve seçenekler arasındaki mesafeleri açarak OMR haritasını ferahlatma ve optik okuma toleransını maksimuma çıkarma talebi doğrultusunda; mevcut basılmış formların okunabilirliğini korurken yeni basılacak formları maksimum ferahlığa kavuşturacak mimari uygulama planıdır.

---

## Kullanıcı İncelemesi & Onaylanan Kararlar

> [!IMPORTANT]
> Kullanıcı ile yapılan netleştirme sonucunda aşağıdaki temel mimari kararlar kesinleştirilmiştir:
> - **Geriye Dönük Uyumluluk**: Yeni basılacak formlar için "Ferah Şablon" (Spacious OMR) varsayılan olacak, ancak arşivdeki ve önceden basılmış mevcut optik formların okunabilmesi (%100 uyumlulukla) kesintisiz korunacaktır.
> - **Maksimum Ferahlık Oranı**: Sayfa sınırları ve A4 soru kutusu (qBox) alanının müsaade ettiği en ferah satır yüksekliği ve şık aralığı uygulanacaktır.

---

## 1. Fiziksel Geometri ve Matematiksel Analiz

### Mevcut (Klasik) vs. Yeni (Ferah) Şablon Karşılaştırması

| Parametre | Mevcut (Klasik) | Yeni (Ferah / Spacious) | İyileşme / Kazanım |
| :--- | :--- | :--- | :--- |
| **Satır Yüksekliği (`rowH`)** | 4.65 mm | **5.40 mm** | **+%16.1 dikey ferahlık** (Dikey kabarcık arası 1.45 mm'den 2.20 mm'ye çıkar, taşmalar sıfırlanır) |
| **Şıklar Arası Mesafe (`bubbleGap`)** | 6.45 mm | **7.60 mm** | **+%17.8 yatay ferahlık** (Şıklar arası net boşluk 3.25 mm'den 4.40 mm'ye çıkar) |
| **Baloncuk Çapı (`bubbleRadius`)** | 1.60 mm (3.2 mm) | **1.65 mm (3.3 mm)** | Öğrenciye daha rahat doldurma alanı, 8 px/mm'de net 26 px çap |
| **Soru No - A Şıkkı Mesafesi** | 4.10 mm | **4.60 mm** | Soru numarası ile A şıkkı arası izolasyon artar |
| **D Şıkkı - Sütun Çizgisi Boşluğu** | 15.70 mm | **11.50 mm** | Güvenli sınır içinde kalır, sütun çizgisi asla D şıkkını etkilemez |
| **Soru Kutusu Dikey Kapasitesi** | 30 soru / 165 mm | 30 soru / 185 mm | 213 mm'lik `qBox` yüksekliğine tam oturur |

---

## 2. Mimari ve Bileşen Değişiklikleri

### A. OMR Çekirdek Motoru (`src/lib/omrEngine.ts`)

1. **Çift Şablon Spesifikasyonu Tanımı**:
   - `OMR_SPECS_SPACIOUS`: Ferah şablon parametreleri (`rowH: 5.4, bubbleGap: 7.6, bubbleRadius: 1.65, startXOffset: 9.8`).
   - `OMR_SPECS_LEGACY`: Mevcut klasik parametreler (`rowH: 4.65, bubbleGap: 6.45`).
   - `OMR_SPECS` varsayılan olarak `OMR_SPECS_SPACIOUS` ile güncellenecek.

2. **Dinamik Şablon Ayrıştırma (Auto-Detection)**:
   - Form taranırken karekoddaki format bilgisi (`T:S` -> Spacious, `T:C` -> Classic) veya sınavın `omrMap.specs` kaydı kontrol edilir.
   - Karekodsuz veya eski baskılarda, satır aralıklarının frekans analiziyle (satır başı siyah referans noktaları) formun klasik mi ferah mı olduğu otomatik algılanır.

```
┌──────────────────────────────────────────────────────────────┐
│                    Taranan Optik Görüntü                    │
└──────────────────────────────┬───────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
       [Karekod / OMR_MAP]           [Oto-Frekans Analizi]
        T:S -> Ferah Şablon           Satır Aralığı: 5.4mm? -> Ferah
        T:C -> Klasik Şablon          Satır Aralığı: 4.65mm? -> Klasik
                └──────────────┬──────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │   Warp Perspective (1680x2376 px, 8 px/mm)  │
        │   Şablona Özel Doğru Koordinat Kümeleri      │
        │   %100 Kusursuz Baloncuk Merkezleme         │
        └──────────────────────────────────────────────┘
```

### B. Baskı & Optik Form Tasarımı (`src/views/KeysAndPrintView.tsx`)

1. **Baskı Önizleme Seçeneği**:
   - Optik form yazdırma ekranına iki seçenekli tasarım anahtarı:
     - **Ferah / Geniş Aralık (Önerilen - Yeni Baskılar İçin)**
     - **Klasik Standart MEB Şablonu (Eski Form Baskılarıyla Birebir)**
2. **Karekod Veri Güncellemesi**:
   - Karekod içeriğine şablon tipi (`T:S` veya `T:C`) eklenerek tarayıcının form tipini anında sıfır hata ile tanıması sağlanır.
3. **Fiziksel Tipografi & CSS**:
   - Satır yüksekliği arttığı için soru numaraları ve baloncuk içi harfler daha okunaklı, aralıklar gözü yormayan MEB standartlarında optimize edilir.

### C. Tarama ve Okuma Ekranı (`src/views/ScanView.tsx`)

1. Hem tekli kamera/fotoğraf taramalarında hem de toplu PDF taramalarında, yüklenen her sayfanın hangi şablon geometrisine ait olduğu tespit edilir.
2. Koordinatlar dinamik olarak o sayfanın şablonuna (`targetOmrToUse`) göre üretilir.

---

## 3. Faydalar ve Risk Analizi

- **Artan Okuma Toleransı**: Şıklar arası boşluğun 3.25 mm'den 4.40 mm'ye, satır boşluğunun 1.45 mm'den 2.20 mm'ye çıkması; öğrencilerin taşırdığı grafit lekelerinin, silgi kalıntılarının ve fotokopi toner lekelerinin komşu hücrelere sızmasını tamamen engeller.
- **Sıfır Risk**: Mevcut basılmış optik formlar için geriye dönük uyumluluk motoru devrede olacağından, kurumun elindeki basılı eski optik kağıtlar ziyan olmaz ve eskisi gibi hatasız okunmaya devam eder.

---

## 4. Doğrulama ve Test Adımları

1. `npm run lint` ve `compile_applet` ile tip/derleme kontrolü.
2. Baskı ekranında yeni ferah şablon ile klasik şablonun A4 üzerinde tam taşmasız görüntülendiğinin teyidi.
3. Hem ferah şablon hem de klasik şablon PDF'lerinin taranarak 7 test öğrencisi (Elif Öztürk, Doruk Can, Hasan Ali Akbulut vb.) üzerinde %100 doğruluk testinin tekrarlanması.
