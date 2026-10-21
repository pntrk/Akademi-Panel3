# Kurum İçi Sınavlar İçin Sekonic SR-55D (Ertem-840) TXT & Optik Form Entegrasyonu

Fiziksel **Sekonic SR-55D** optik okuyucu makineden alınan **Ertem 840** TXT çıktılarının ve Ertem-840 optik şablonunun **yalnızca Kurum İçi Deneme Sınavlarında** (`examType === 'internal'`) geçerli olacak şekilde sisteme entegre edilmesi.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Kullanıcı ile teyit edilen kesin tercihler ve kapsam sınırları:
> - **Sadece Kurum İçi Sınav Kısıtlaması**: Bu özellik (hem canlı kamera Ertem-840 şablonu hem de Sekonic SR-55D TXT yükleme seçeneği) **yalnızca Kurum İçi Deneme Sınavlarında** (`examType === 'internal'`) aktif olacak; harici yayınevi sınavlarında görünmeyecek ve karışıklık yaratmayacaktır.
> - **Arayüz Konumu**: Tarama ekranında (ScanView) kurum içi bir sınav seçildiğinde ayrı ve belirgin bir **"⚡ Sekonic TXT Yükle"** sekmesi açılacak.
> - **Eşleşmeyen Öğrenci Yönetimi**: TXT dosyasında numarası veya adı kütükte bulunamayan öğrenciler için öğretmen onayına sunulan ayrı bir **"Eşleşmeyen Öğrenciler"** paneli sunulacak (Tek tıkla kütüğe ekleme, listeden seçme veya atlama).
> - **Mevcut Sonuçların Güncellenmesi**: Aynı öğrencinin ilgili kurum içi sınavda önceden bir sonucu varsa, yeni yüklenen TXT verisiyle eski sonuç güncellenecek.
> - **Karakter Kodlaması**: Sekonic makinelerinin standart Windows-1254 (Türkçe CP1254/ISO-8859-9) karakter yapısı otomatik çözülerek Türkçe karakterler eksiksiz korunacak.

---

### 1. Overview & Core Concept

- **Ne Yapıyor?**: Kurum içi deneme sınavlarında iki yeni seçenek sunar:
  1. Sekonic SR-55D optik okuyucu makinesinden çıkan 280 karakterlik Ertem-840 `.TXT` / `.DAT` dosyasını tek tıkla yükleyip tüm okulun sonuçlarını saniyeler içinde hesaplama.
  2. Canlı kamera veya PDF taramasında Ertem-840 şablonunu seçebilme.
- **Kapsam**: Yalnızca kurumun kendi bastığı veya optik makinede okuttuğu kurum içi sınavlar. Harici yayınevi sınavları bu kuralın dışındadır.
- **Sağlanan Değer**: Okul elindeki Sekonic makinesini doğrudan Akademi Panel ekosistemine bağlar; kurum içi sınavlar için harici karne yazılımlarına veya lisanslara ihtiyaç bırakmaz.

---

### 2. User Experience & Visual Design

#### A. Kurum İçi Sınav Koşullu Sekme Yapısı
`ScanView` ekranında sadece kurum içi bir sınav seçildiğinde 3. sekme görünür:
1. `📷 Canlı Kamera Taraması` (Karekodlu & Ertem-840 şablonları)
2. `📄 PDF / Görsel Toplu Tarama`
3. `⚡ Sekonic TXT Yükle (Kurum İçi Optik Makine)`

*(Harici yayınevi sınavı seçildiğinde yalnızca standart kamera/dosya taraması gösterilir, Sekonic sekmesi gizlenir).*

#### B. Sekonic TXT Yükleme Arayüzü
- Seçili kurum içi sınavın adını, kitapçık anahtarlarını ve sınıf seviyesini gösteren bilgilendirme başlığı.
- Sürükle-bırak destekli dosya yükleme alanı (`.txt`, `.dat`).
- Yükleme sonrası:
  - Toplam okunan öğrenci sayısı,
  - Başarıyla kütükle eşleşen öğrenci sayısı,
  - Eşleşmeyen öğrenci sayısı özet kartları.

#### C. Eşleşmeyen Öğrenciler Onay & Yönetim Paneli
Kütükte bulunamayan öğrenciler için:
- Kodlanan No ve İsim (`00091 - YİĞİT GEÇKOL - 8/A`)
- 3 Hızlı Aksiyon:
  - `[ + Yeni Öğrenci Olarak Kütüğe Ekle ]`
  - `[ 🔍 Mevcut Öğrenciyle Eşleştir ]` (Arama menüsü)
  - `[ Bu Satırı Atla ]`

#### D. Sonuç Önizleme ve Tek Tıkla Kayıt
- Her öğrencinin 6 ders bazında Doğru / Yanlış / Boş / Net dökümü ve LGS toplam puanı.
- Varsa `Mevcut Sonuç Güncellenecek` rozeti.
- `[ Tüm Sonuçları Kaydet ve Karne Oluştur ]` butonu.

---

### 3. Key Product Decisions & Trade-Offs

- **Karar 1: Sadece Kurum İçi Sınav Filtresi**
  - *Seçilen Yaklaşım*: `selectedExam.examType === 'internal'` veya kuruma özel cevap anahtarlı sınavlar için aktif edilir.
  - *Neden*: Harici yayınevi sınavlarında farklı soru sayıları, yayınevi şablonları veya harici veri formatları olabileceğinden karışıklık önlenir.
- **Karar 2: 280 Karakter Ertem-840 Satır Ayrıştırma Standardı**
  - `0 - 3`: Form Kodu (`840`)
  - `3 - 9`: Kurum Kodu (`707487`)
  - `9 - 14`: Öğrenci No (`00091` -> `91`)
  - `14 - 34`: Ad Soyad (`YİĞİT GEÇKOL`)
  - `56`: Sınıf (`8`)
  - `57`: Şube (`A`)
  - `58`: Cinsiyet (`E` / `K`)
  - `59`: Kitapçık (`A` / `B` - boşsa 'A' kabul edilir)
  - `160 - 280`: 4-8. Sınıf Cevap Alanı (20 Türkçe, 20 Sosyal/İnkılap, 20 Din, 20 İngilizce, 20 Matematik, 20 Fen)
- **Karar 3: Türkçe Karakter Kodlaması (Windows-1254 / ISO-8859-9)**
  - Sekonic makinelerinden çıkan dosyalarda "İ, Ğ, Ş, Ç, Ö, Ü" karakterleri Windows-1254 tablosunda yer alır. `FileReader.readAsText(file, 'windows-1254')` kullanılarak isimlerin bozulması önlenir.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ScanView (Kurum İçi Sınav)                      │
│                                                                        │
│   Sınav: [ Atatürk Ortaokulu 8. Sınıf Son Viraj (Kurum İçi) ]          │
│                                                                        │
│  ┌───────────────────────┬───────────────────┬───────────────────────┐ │
│  │ 📷 Kamera Taraması    │ 📄 PDF / Görsel   │ ⚡ Sekonic TXT Yükle  │ │
│  └───────────────────────┴───────────────────┴───────────┬───────────┘ │
└──────────────────────────────────────────────────────────┼─────────────┘
                                                           │ (Yalnızca Kurum İçi)
                                                           ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     sekonicParser.ts                                   │
│                                                                        │
│   - Windows-1254 decoder                                               │
│   - 280-char Ertem-840 validator                                       │
│   - Extract Student No, Name, Class/Section, Booklet, 6 Subject Answers│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Student Matching & Resolution                        │
│                                                                        │
│   - Matched by Student No + Name Check (Auto-approved)                 │
│   - Unmatched Review List: [Add to Roster] | [Link to Student] | [Skip]│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                Scoring & Persistence (Internal Exam)                   │
│                                                                        │
│   - Score against Internal Exam Answer Keys (Booklet A/B)              │
│   - Overwrite existing results for re-uploaded students                │
│   - saveOmrExamResults() -> AppContext state & Firestore sync          │
└────────────────────────────────────────────────────────────────────────┘
```

#### Bileşen ve Dosya Planı
1. **`src/lib/sekonicParser.ts` (Yeni Dosya)**:
   - Ertem-840 / Sekonic SR-55D satır çözümleyici fonksiyonları.
   - Kurum kodu, öğrenci no, ad-soyad, sınıf, şube, kitapçık türü ve 6 branş cevap haritası.
   - Windows-1254 metin okuyucu.
2. **`src/views/ScanView.tsx` (Entegrasyon)**:
   - Seçili sınavın kurum içi denetimi (`isInternalExam`).
   - Yalnızca kurum içi sınavlarda görünen `Sekonic TXT Yükle` sekmesi.
   - Dosya yükleme, eşleşmeyen öğrenciler paneli, önizleme tablosu ve kaydetme akışı.
3. **`src/lib/omrTemplates.ts`**:
   - Ertem-840 kamera vizör kılavuzu ve şablon tanımları (yalnızca kurum içi sınav taramalarında geçerli).
