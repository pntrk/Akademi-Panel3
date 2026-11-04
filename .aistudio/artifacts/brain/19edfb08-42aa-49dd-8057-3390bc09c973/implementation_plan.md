# Yönetici Kontrollü LGS Kazanım Yönetimi & AI Destekli Soru Eşleştirme Planı

Bu mimari plan, kazanım eşleştirme ve yönetim yetkisini **doğrudan Yönetici (Admin) Paneline** vererek; yöneticinin tanımladığı kazanım haritası üzerinden **tüm öğretmen kullanıcıların** otomatik olarak zenginleştirilmiş kazanım analizli sınav sonuçlarına, karnelere ve koçluk reçetelerine ulaşmasını sağlar.

---

### Kesinleşen İş Akışı ve Rol Ayrımı

> [!IMPORTANT]
> 1. **Yetki ve Giriş Noktası (Yalnızca Yönetici / Admin):**
>    - Sınav kazanım tanımlama, dosya yükleme ve yapay zeka analizi işlemleri yalnızca yönetici (admin) rolündeki kullanıcılara açıktır.
> 2. **Senaryo A - Hazır Yayıncı Dosyası Var İse:**
>    - Yönetici, ilgili deneme sınavının yanındaki **"🎯 Kazanım & Anahtar Yönetimi"** butonuna tıklar.
>    - Yayıncıdan gelen XML (kullanıcının ilettiği MOZAİK TG-1 benzeri) veya Excel dosyasını yükler.
>    - Sistem 1 saniyede A/B cevap anahtarlarını, soru numaralarını ve MEB kazanım kodlarını sınav kaydına işler.
> 3. **Senaryo B - Hazır Kazanım Dosyası Yok İse (Yapay Zeka Destekli Kitapçık Analizi):**
>    - Yönetici, deneme sınavının taranmış PDF kitapçığını (veya cevap anahtarını) sisteme yükler.
>    - Sistem, sunucu tarafında barındırılan resmi **MEB 8. Sınıf Kazanım Veritabanını** referans alarak `gemini-3.8-flash` ile taranmış PDF sayfalarındaki soruları okur ve en isabetli MEB kazanımıyla birebir eşleştirir.
>    - Yöneticiye onay ekranında eşleştirmeyi sunar, yönetici tek tıkla onaylayıp kaydeder.
> 4. **Öğretmen Kullanıcı Deneyimi (Otomatik & Sıfır Zahmet):**
>    - Öğretmenler sisteme girdiğinde hiçbir teknik eşleştirme veya dosya yükleme işlemiyle uğraşmaz.
>    - Yönetici kazanımları kaydettiği anda; öğretmenlerin görüntülediği **Sınav Sonuçları**, **Öğrenci Karneleri**, **Zümre Sınıf Analizleri** ve **Yönlendirme Koçu & Gelişim Reçetesi** otomatik olarak kazanım bazlı detaylara, isabet yüzdelerine ve eksik konu listelerine kavuşur.

---

## 1. Sistem Mimarisi ve Veri Akışı

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                YÖNETİCİ (ADMIN) PANELİ                                 │
│                                                                                        │
│  [Senaryo A: XML / Excel Yükle]              [Senaryo B: Taranmış Kitapçık PDF Yükle] │
│  Yayıncı şablonundan anında A/B               Gemini 3.8 Flash hazır MEB kazanım       │
│  anahtarları + 90 MEB kazanımı                ağacını kullanarak soruları eşleştirir   │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                                           ▼ (Yönetici Onayla & Kaydet)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MERKEZİ KÜTÜK & VERİTABANI (DRIVE / MEMORY)                     │
│  Exam.questionOutcomes: { [qIndex]: { code: "8.3.2.1", desc: "Bağlamdan..." } }       │
│  Exam.keys: { A: [...], B: [...] }                                                     │
│  * Ekstra Boyut: Sınav başına sadece ~1.8 KB (Sistemi ve Drive'ı asla yormaz)          │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
                                           ▼ (Otomatik ve Kesintisiz Yayın)
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                ÖĞRETMEN KULLANICI GÖRÜNÜMÜ                             │
│                                                                                        │
│  ┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐      │
│  │  ÖĞRENCİ KARNESİ     │    │  SINIF ZÜMRE ANALİZİ │    │  YÖNLENDİRME KOÇU    │      │
│  │ • Kazanım İsabet %   │    │ • Sınıfın En Çok     │    │ • Zayıf Kazanımlara  │      │
│  │ • Eksik Konu Listesi │    │   Hata Yapılan 5     │    │   Özel 3 Günlük      │      │
│  │ • Doğru/Yanlış/Boş   │    │   Kritik Kazanımı    │    │   Çalışma Reçetesi   │      │
│  └──────────────────────┘    └──────────────────────┘    └──────────────────────┘      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Arayüz ve Kullanıcı Deneyimi (UI & UX)

### A. Yönetici Paneli: "Kazanım & Anahtar Yönetimi" Modalı (`AdminOnly`)
- Sınavlar sekmesinde (`ExamsView.tsx`), yalnızca admin yetkisine sahip kullanıcıların görebileceği **"🎯 Kazanım & Anahtar Tanımla"** butonu yer alır (Öğretmen arayüzünde bu buton gizlenir).
- Modal içinde 2 net seçenek sunulur:
  1. **"Hazır Kazanım Dosyası Yükle (XML / Excel)"**:
     - Kullanıcının ilettiği MOZAİK TG-1 benzeri dosyaları sürükle-bırak ile kabul eder.
     - Dersleri (Türkçe, Matematik, Fen, İnkılap, Din, İngilizce), soru numaralarını, A/B karşılıklarını ve kazanım metinlerini saniyeler içinde matrise döker.
  2. **"Taranmış Kitapçık PDF'inden Yapay Zeka ile Eşleştir"**:
     - Denemenin taranmış PDF kitapçığı yüklenir.
     - Sunucu tarafında `gemini-3.8-flash`, sistemde yüklü hazır MEB 8. Sınıf kazanım kataloğu ile PDF'teki soru metinlerini çapraz sorgulayarak her soruya en uygun kazanımı belirler.
     - Yöneticiye soru soru eşleştirme tablosu gösterilir; yönetici dilerse elle revize edebilir ve "Kazanımları Sisteme Kaydet"e tıklar.

### B. Öğretmen Kullanıcı Deneyimi (Otomatik Kazanım Görünümü)
- Öğretmen sınav sonuçları sayfasına girdiğinde:
  - Eğer o denemenin kazanımları yönetici tarafından tanımlanmışsa, sınav başlığında **"🎯 Kazanım Analizi Aktif"** göstergesi yer alır.
  - Öğrenci listesinde herhangi bir öğrencinin karnesine tıklandığında:
    - **Ders Bazlı Kazanım Çizelgesi:** Öğrencinin hangi kazanımda kaç doğru, yanlış veya boş yaptığı, isabet oranı renkli başarı çubuklarıyla sunulur (%80+ yeşil, %50-79 mavi, <%50 amber/kırmızı).
    - **Eksik Konular Listesi:** Öğrencinin net kaybettiği odak MEB kazanımları özetlenir.
  - **Zümre / Sınıf Genel Özeti:**
    - Öğretmen sınıfını (örn: 8-A) seçtiğinde, sınıfın en çok takıldığı ve zümre derslerinde tekrar edilmesi gereken **"Ortak 5 Kritik Kazanım"** kartı gösterilir.

### C. Yönlendirme Koçu & Gelişim Reçetesi Entegrasyonu
- Akademi Arena ve koçluk ekranında (`StudentCoachingModal.tsx`):
  - Öğrencinin denemedeki en zayıf olduğu 2 kazanım (örn: *Matematik 8.1.1.2 EBOB-EKOK* ve *Fen 8.1.1.1.11 Mevsimler*), *"Bir Sonraki Deneme İçin 3 Maddelik Eylem Planı"* bölümüne doğrudan entegre edilir.
  - Yazdırılan veya PDF indirilen koçluk raporunda bu kazanımlar pedagojik reçete olarak öğrenciye ve veliye teslim edilebilir.

---

## 3. Teknik Veri Modeli ve Performans Garantisi

### Veri Boyutu ve Depolama
Kitapçık sayfaları veya resimler veritabanına **kaydedilmez**. Sadece 90 sorunun kazanım kodları ve kısa konu başlıkları JSON nesnesi olarak saklanır:
```typescript
export interface QuestionOutcomeItem {
  qIndex: number;          // Soru no: 1 .. 90
  subject: string;         // "Türkçe", "Matematik", "Fen", vb.
  correctAnswer: string;   // Doğru cevap: "A", "B", "C", "D"
  altQIndex?: number;      // B kitapçığı karşılığı (örn: 9)
  outcomeCode: string;     // MEB kodu: "8.3.2.1"
  outcomeDesc: string;     // Kazanım: "Bağlamdan yararlanarak..."
}

// Exam arayüzüne eklenecek hafif alan:
export interface Exam {
  // ... mevcut alanlar ...
  outcomes?: QuestionOutcomeItem[]; // 90 sorunun kazanım dökümü (~1.8 KB)
  hasOutcomes?: boolean;            // Kazanım verisinin varlık bayrağı
}
```
Bu sayede Drive kütük dosyası ve Firestore kotaları %100 güvende kalır; sistemde en ufak bir yavaşlama yaşanmaz.

---

## 4. Yapılacak Değişiklikler ve Aşamalar

### Aşama 1: MEB 8. Sınıf Standart Kazanım Kataloğu (`src/lib/curriculumData.ts`)
- 6 LGS branşının (Türkçe, Matematik, Fen Bilimleri, T.C. İnkılap Tarihi, Din Kültürü, İngilizce) resmi MEB kazanım kodları, ünite ve konu adları sisteme statik referans kütüphanesi olarak eklenecek.

### Aşama 2: Yayıncı XML & Excel Parser Modülü (`src/lib/curriculumParser.ts`)
- Yöneticinin yükleyeceği XML (Microsoft SpreadsheetML) ve Excel tablolarını (`Kitapçık`, `Ders`, `A Soru`, `B Soru`, `Cevap`, `Kazanım Kodu`, `Kazanım-1`) hatasız okuyacak parser geliştirilecek.

### Aşama 3: Sunucu Tarafı Gemini 3.8 Flash PDF Analizi (`server.ts`)
- `POST /api/gemini/match-outcomes` endpoint'i:
  - Taranmış PDF kitapçığı yüklendiğinde, sistemdeki MEB kazanım listesini context olarak alıp `@google/genai` (gemini-3.8-flash) ile soruları eşleştirerek JSON formatında döndürecek.

### Aşama 4: Yönetici Paneli Kazanım Modalı (`src/components/exams/ExamOutcomeModal.tsx`)
- Yalnızca yöneticilere açık olacak modal:
  - XML/Excel dosyasını sürükleyip bırakma.
  - Taranmış PDF kitapçığı yükleyip AI ile otomatik eşleştirme.
  - Soru ve kazanım eşleştirme tablosunu önizleme, düzenleme ve kaydetme.

### Aşama 5: Öğretmenler İçin Kazanım Analiz ve Rapor Ekranları
- `src/views/ResultsView.tsx`: Öğrenci sınav karnesinde "Kazanım Başarı Tablosu", "Eksik Konular" ve öğretmen için "Sınıfın En Çok Hata Yaptığı 5 Kazanım" panelinin eklenmesi.
- `src/components/coaching/StudentCoachingModal.tsx` & `src/lib/coachEngine.ts`: Koçluk reçetesine zayıf kazanımların dinamik eklenmesi ve yazdırılabilir/PDF çıktısına yansıtılması.

---

## 5. Doğrulama ve Test Adımları

1. **Örnek XML Testi**: Yöneticinin MOZAİK TG-1 XML dosyasını yüklediğinde 90 sorunun, A/B cevaplarının ve kazanımlarının 1 saniyede eksiksiz ayrıştırıldığı doğrulanacak.
2. **AI PDF Testi**: Taranmış örnek bir LGS kitapçık/cevap anahtarı PDF'i ile Gemini 3.8 Flash modelinin doğru MEB kazanım kodlarını ürettiği test edilecek.
3. **Öğretmen Görünüm Doğrulaması**: Yönetici kazanımı kaydettikten sonra öğretmen kullanıcının sonuçlar ekranında, karnede ve koçluk raporunda tüm kazanım verilerini anında ve hatasız gördüğü test edilecek.
4. **Derleme & Tip Güvenliği**: `compile_applet` ve `lint_applet` çalıştırılarak sıfır TypeScript hatası ile sistem bütünlüğü teyit edilecek.
