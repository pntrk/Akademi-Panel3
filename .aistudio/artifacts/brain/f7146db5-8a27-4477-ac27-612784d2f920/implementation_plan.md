# Sınav Sonuçları Görünümü & Sıfır Veri Kaybıyla JSON Yedek Boyutu Optimizasyonu Planı

Bu plan iki temel ihtiyacı kapsamaktadır:
1. **Sınav Sonuçları Arayüzü:** Ekran açıldığında varsayılan olarak **8. Sınıflar** filtrelenmiş halde gelmesi ve ilk 50 öğrencinin anında render edilerek arayüz donmasının engellenmesi.
2. **JSON Yedekleme & Veri Mimarisi Optimizasyonu:** 329 öğrencinin sınav sonuçları aktarıldığında Excel boyutu 80-100 KB olmasına rağmen JSON yedeğinde yaşanan ~2.20 MB'lık veri şişmesinin kök nedenlerinin giderilmesi; hiçbir sınav, net, puan, sıralama veya karne verisi kaybolmaksızın dosya boyutunun %80–85 oranında hafifletilmesi.

---

### Kullanıcı Tercihleri ve Kararları (Turn 1 Yanıtları)

> [!IMPORTANT]
> Kullanıcı tarafından onaylanan tercihler:
- **JSON Biçimlendirmesi:** Optimize okunabilir JSON (Gereksiz tekrarlar, boş rozet nesneleri ve çift kayıtlar arındırılmış, okunabilir ve temiz yapı).
- **Ders Sonuçları & Alias Yönetimi:** Ders bazlı sonuç nesnelerinde mükerrer takma ad kopyaları (`İnkılap Tarihi`, `Sosyal Bilgiler`, `Tarih / Sosyal Bilgiler`, `ing`, `ingilizce` vb. çoğaltmaları) yerine **Standart Müfredat Dersi** olarak tekil ve temiz saklanacaktır. Arayüzde veya karnede ihtiyaç duyulan tüm varyasyonlar çalışma zamanında (runtime) dinamik çözümlenecektir.
- **Sonuçların Saklanma Konumu:** Sonuç nesneleri sınav nesnesi (`exams[].results`) altında **tekil birincil kaynak (Single Source of Truth)** olarak tutulacak; yedeğe aktarılırken aynı yüzlerce nesnenin `state.results` içinde tekrar kopyalanarak dosya boyutunu 2 katına çıkarması engellenecektir. Geri yükleme (restore) motoru eski çift kayıtlı yedekleri de yeni optimize yedekleri de eksiksiz tanıyacaktır.
- **Sınav Sonuçları Varsayılan Kademe:** Ekran açılışında kademe filtresi doğrudan **"8. Sınıflar"** seçili gelecek, kullanıcı isterse "Tüm Kademeler"e veya diğer sınıflara geçebilecektir.

---

## 1. JSON Yedeğindeki 2.20 MB Artışın Derinlemesine Analizi

| Problem Unsuru | Durum ve Kök Neden | Boyuta Etkisi | Çözüm Yaklaşımı |
| :--- | :--- | :--- | :--- |
| **1. Çift Dizi Depolama (Dual Storage)** | Aynı 329 öğrenci sonucu hem `exams[x].results` hem de global `state.results` içinde iki tam kopya olarak JSON'a yazılıyor. | Boyutu doğrudan **2 katına** çıkarıyor (~1 MB fazlalık). | Sonuçlar sınavın altında tekil (`exams[].results`) saklanır; global liste sadece hafif bir referans tutar veya yedek dışa aktarılırken `exams` birincil kaynak alınır. |
| **2. Mükerrer Ders Anahtarları (Alias Multiplication)** | Her öğrencinin `subjectScores` ve `scores` nesnesinde geriye dönük uyumluluk adına Tarih ve İngilizce için 4-5 farklı takma ad aynı nesneye kopyalanıyor. | 329 öğrenci × 5 ders × 4 alias = binlerce gereksiz alt nesne. | Sadece tekil standart isim (`Türkçe`, `Matematik`, `Fen Bilimleri`, `T.C. İnkılap Tarihi ve Atatürkçülük`, `Din Kültürü ve Ahlak Bilgisi`, `İngilizce`) saklanır. |
| **3. Aşırı Çift Alanlar (Redundant Fields)** | Aynı nesnede hem `studentNo` hem `no`, hem `studentName` hem `name`, hem `average` hem `net`, hem `studentClass` hem `classStr` saklanıyor. | Satır başına 8-10 ekstra anahtar-değer çifti. | Temiz, tekil alan disiplini uygulanır; eski sürümler için geriye dönük okuyucu (getter) korunur. |
| **4. Lig Rozet Alanlarının Şişmesi** | `recalculateLeagueForStudents` her öğrenciye 18 adet sıfır değerli boş rozet anahtarı ve aylar bazında boş `monthlyLeagueData` basıyor. | Okuldaki tüm öğrenciler için binlerce satır boş JSON. | Sıfır olan rozetler ve boş veriler nesnede yer kaplamaz; sadece kazanılan rozetler ve puanlar saklanır. |
| **5. 2 Boşluklu Pretty-Print (`null, 2`)** | 329 öğrencinin her biri 100+ satıra yayıldığında yüz binlerce `\n` ve boşluk karakteri oluşuyor. | Toplam boyutta ekstra ~400-500 KB saf boşluk karakteri. | Nesne alanları sadeleştirilerek satır sayısı minimize edilir ve temiz JSON üretilir. |

---

## 2. Kullanıcı Deneyimi ve Arayüz (UX & UI)

### 2.1 Sınav Sonuçları Ekranı
1. **Varsayılan 8. Sınıf Görünümü:** Sınav sonuçları sekmesine tıklandığında kademe seçici otomatik olarak `"8"` (8. Sınıflar) ile açılır. Sınavda 8. sınıf yoksa mevcut kademelerden ilki seçilir.
2. **Kademeli Yükleme (Progressive Loading):** Yüzlerce öğrencinin tamamı tek seferde DOM'a yüklenmek yerine ilk 50 öğrenci anında render edilir. Tablo sonuna yaklaşıldıkça sonraki 50'lik bloklar akıcı biçimde listeye eklenir.
3. **Varsayılan Kompakt Görünüm:** Ders bazlı Doğru/Yanlış/Net sütunları ilk açılışta daraltılmış (gizli) olarak gelir; özet sütunlar (Toplam Net, LGS Puanı) anında görünür. "Ders Netleri" butonu tıklandığında detay sütunlar açılır.
4. **Hızlı Filtre & Arama:** Sınıf, şube ve isim aramasında filtre değiştikçe liste anında tepki verir, donma ve gecikme yaşanmaz.

### 2.2 Yedekleme ve Dışa Aktarma Deneyimi
1. **Şeffaf ve Hızlı Yedek İndirme:** "Yedek Al" butonuna basıldığında indirilen dosya boyutu 2.5–3 MB yerine ~250–350 KB seviyesine iner.
2. **Geri Yükleme Güvencesi (Zero Data Loss):** Kullanıcı ister dün aldığı eski 2.5 MB'lık yedeği, ister yeni optimize yedeği yüklesin; sistem her iki formatı da %100 doğrulukla ayrıştırır ve verileri eksiksiz geri yükler.

---

## 3. Teknik Mimari ve Veri Akışı

```
┌─────────────────────────────────────────────────────────────────┐
│                    Excel Dosyası Yükleme                         │
│                    (329 Öğrenci Sonucu)                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Standardized Clean ExamResult Parser               │
│  - Tekil standart ders anahtarları (Alias tekrarı yok)          │
│  - Tekil kimlik alanları (no, name, className, net, score)     │
│  - Sıfır rozet şişmesi olmadan salt kazanımlar                   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   State & Storage Optimizasyonu                 │
│  - Primary: exam.results içinde tekil depolama                  │
│  - Sınav sonuçları ile kütük eşleştirmesi O(1) Map önbellekli   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│               Optimize JSON Export / Backup Engine              │
│  - exams[].results birincil kaynak olarak dışa aktarılır        │
│  - Mükerrer global results dizisi sıkıştırılır/temizlenir       │
│  - Geri yükleme (Restore) geriye dönük tam uyumlu çalışır       │
│  - Sonuç: ~2.5 MB yerine ~300 KB temiz ve kayıpsız JSON!        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Uygulama Adımları ve Değişiklik Sırası

### Adım 1: Sınav Sonuçları Ekranı Varsayılan 8. Sınıf & Kademeli Render (`src/views/ResultsView.tsx`)
- `selectedGradeFilter` başlangıç değerini `"8"` yapma; sınavda 8. sınıf öğrencisi bulunup bulunmadığını kontrol ederek akıllı geri düşüş sağlama.
- `showSubjectColumns` varsayılanını `false` (daraltılmış) yaparak ilk açılışta gereksiz sütun render yükünü kaldırma.
- Kütük araması için `Map<studentNo, Student>` tabanlı $O(1)$ arama önbelleği oluşturma.
- `visibleCount: 50` ile kademeli yükleme (infinite scroll / daha fazla göster) mekanizmasını tabloya entegre etme.

### Adım 2: Excel İçe Aktarma Mantığında Veri Temizliği (`src/views/ResultsView.tsx`)
- `handlePublisherExcelUpload` içinde `subjectScores` ve `scores` nesnelerine yapılan mükerrer takma ad kopyalamalarını temizleme; standart kanonik ders isimlerini kullanma.
- `newResults` nesnesi oluşturulurken gereksiz çift alanları (`totalEmpty`, boş `badges`, `percentile: undefined` vb.) ayıklayarak temiz veri nesnesi üretme.

### Adım 3: Lig Hesaplama Şişmesinin Önlenmesi (`src/lib/utils.ts`)
- `recalculateLeagueForStudents` içinde her öğrenciye basılan boş `badges` ve boş aylık istatistik nesnelerini sadece kazanım varsa ekleyecek şekilde sadeleştirme.

### Adım 4: JSON Yedek Dışa Aktarma ve İçe Aktarma Motoru (`src/components/Layout.tsx` & `src/context/AppContext.tsx`)
- `Layout.tsx` ve `CloudBackupModal.tsx` içindeki yedek oluşturucularda:
  - `backupData` oluşturulurken `cleanExams` ve `cleanResults` arındırması uygulama.
  - Sınav altındaki `results` mevcut olduğunda global `results` listesindeki aynı kopyaları ayıklama veya birleştirilmiş tekil şemaya dönüştürme.
- `restoreBackup` fonksiyonunda geriye dönük tam uyumluluğu sağlama: Hem eski çift kayıtlı yedekleri hem yeni tekil optimize yedekleri sorunsuz tanıyıp eşleştirme.

### Adım 5: Doğrulama ve Test
- `compile_applet` ile TypeScript derleme doğrulaması.
- `lint_applet` ile kod standartları kontrolü.
- Örnek veri ile yedek alıp boyut kontrolü ve geri yükleme testi.
