# Birleştirilmiş Sınav Yoklama ve Devamsızlık Raporu Modülü

Tüm salonlardan öğretmenler tarafından anlık olarak gönderilen sınav yoklama verilerini tek bir merkezde birleştiren, hem görsel interaktif tablo hem Excel (.xlsx) dışa aktarımı hem de resmi sınav devamsızlık tutanağı formatında yazdırma (Print) desteği sunan konsolide raporlama modülü.

### User Review & Critical Decisions

> [!IMPORTANT]
> Kullanıcı ile yapılan netleştirme aşamasında teyit edilen tercihler ve mimari kararlar aşağıda özetlenmiştir:

- **Confirmed Decision 1 (Sunum & İndirme Formatı)**: Kullanıcı tercihine uygun olarak, rapor hem ekranda canlı filtrelenebilir görsel tablo olarak sunulacak hem de tek tıkla Excel tablosu (.xlsx) ve resmi A4 sınav yoklama tutanağı formatında yazdırılabilir / PDF olarak kaydedilebilir olacak.
- **Confirmed Decision 2 (Gruplama & Görünüm Yapısı)**: Devamsız öğrenciler hem **Salona Göre** (hangi salonda hangi masada kim gelmedi, gözetmen kimdi) hem de **Sınıf / Şubeye Göre** (8-A'dan kimler yok, 8-B'den kimler yok - e-Okul veya okul yoklama defterine 1 dakikada işlemek için) iki ayrı sekmede gruplanmış olarak sunulacak.
- **Confirmed Decision 3 (Erişim & Yetkilendirme)**: Buton ve modül Salonlar & Oturma Düzeni ekranında üst barında "📊 Birleştirilmiş Yoklama Raporu" olarak yöneticiler (admin) için her zaman görünür olacak; sınav seçimi yapılarak geçmiş sınavların veya bugünkü canlı sınavın raporu anında alınabilecek.

---

### 1. Overview & Core Concept

- **What It Does**: Sınav günü veya sonrasında, öğretmenlerin salonlarda aldıkları yoklamaları (`attendances`) tek merkezde birleştirir. Kaç öğrencinin katıldığı, kaç öğrencinin gelmediği, salon bazlı katılım oranları ve gelmeyen öğrencilerin numarası, adı, sınıfı, salon adı, sıra numarası ve gözetmen bilgileri anlık olarak toplanıp raporlanır.
- **Target Audience / Persona**: Okul idarecileri, sınav koordinatörleri ve müdür yardımcıları. Sınav esnasında veya sınav biter bitmez devamsızlıkları okul bilgi sistemine (e-Okul / kütük) işlemek ve basılı sınav evrakı arşivi oluşturmak isteyen yöneticiler.
- **Key Value**: Yöneticilerin onlarca salonu tek tek gezip kağıt yoklama toplaması veya her salonun içine tek tek tıklayıp kim gelmedi diye not alması ihtiyacını tamamen ortadan kaldırır; tek tıkla tüm okulun sınav devamsızlık listesini hazır hale getirir.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Açılış & Sınav Seçimi*: Yönetici "Salonlar & Oturma Düzeni" ekranında üst eylem çubuğundaki **"📊 Sınav Yoklama Raporu"** butonuna tıklar.
  2. *Görsel Rapor Modalı / Sayfası*: Açılan modal veya raporda ilgili sınav (varsayılan olarak bugünkü sınav, açılır listeden istenen başka bir deneme sınavı) seçilir.
  3. *Özet Kartları & İstatistikler*: En üstte 4 net gösterge yer alır:
     - Toplam Kayıtlı / Oturan Öğrenci Sayısı
     - Sınava Katılanlar (Mevcut) ve Katılım Yüzdesi
     - Devamsız Öğrenci Sayısı ve Devamsızlık Oranı
     - Yoklaması Tamamlanan Salon / Toplam Salon Oranı (örn: 12 / 12 Salon Teslim Edildi)
  4. *İki Sekmeli Gruplanmış İnceleme*:
     - **Sekme A - Salona Göre Dağılım**: Her salon bir bölüm olarak listelenir; gözetmen öğretmen, teslim saati, toplam/gelen/gelmeyen sayıları ve o salondaki devamsızlar (sıra no, öğrenci no, ad soyad, sınıf).
     - **Sekme B - Sınıf / Şubeye Göre Devamsızlar (e-Okul Uyumlu)**: 8-A, 8-B, 8-C vb. şubelere göre ayrılmış liste; idareci e-Okul'a sınıf yoklaması girerken doğrudan şube bazında gelmeyenleri tek bakışta görür.
  5. *Dışa Aktarma Eylemleri*:
     - **Excel İndir**: Detaylı, renkli başlıklı, salon ve şube sayfalarını veya birleşik listesini içeren `.xlsx` dosyası üretir.
     - **Yazdır / PDF**: Resmi antetli "T.C. MEB / Okul Sınav Yoklama ve Devamsızlık Teslim Tutanağı" formatında, imza yerleri bulunan A4 yazdırma şablonunu tetikler.

- **Visual Identity & Theme**:
  - *Stil*: Temiz, kurumsal SaaS yönetim konsolu (Slate & Indigo/Emerald vurguları).
  - *Tipografi*: Başlıklar ve metinler için `Plus Jakarta Sans`, sayısal veriler, yüzdeler ve öğrenci numaraları için `font-mono tabular-nums`.
  - *Kart & Liste Mimarisi*: Kart içinde kart yok; tek seviye gölgesiz hairline border (`border-slate-200 dark:border-slate-800`), ferah boşluklar ve net sütun hizalamaları.
  - *Durum Renkleri*: Katılanlar için sessiz zümrüt yeşili (`text-emerald-700 bg-emerald-50`), devamsızlar için dikkat çeken ama göz yormayan mercan kırmızısı (`text-rose-700 bg-rose-50`), bekleyen salonlar için kehribar (`text-amber-700 bg-amber-50`).

- **Interactive Feedback & Motion**:
  - Sınav seçiminde anlık tepki süresi ($\le 50\text{ms}$).
  - Yoklama verileri anlık olarak yerel önbellek ve Firestore üzerinden senkronize olduğundan, öğretmen yeni bir yoklama gönderdiğinde rapordaki sayaçlar anında canlı güncellenir.
  - Excel üretimi ve yazdırma esnasında butonlarda spinner veya başarı simgesi bildirimi.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Raporun Konumu & Erişilebilirliği**
  - *Chosen Approach*: `HallsView.tsx` içerisine hem üst bar hızlı eylem butonu hem de zengin, tam ekran açılabilen "AttendanceReportModal" bileşeni entegre edilir.
  - *Why*: Yoklama alma işlevi zaten Salonlar menüsünde yer aldığından idarecinin bağlamdan kopmadan aynı yerde rapor alması en doğal kullanıcı deneyimidir.
  - *Alternatives Considered*: Ayrı bir üst menü sekmesi eklemek; ancak üst menüyü kalabalıklaştırmamak ve sadece sınav günleri ihtiyaç duyulan bu raporu salonlar ekranında tutmak daha derli topludur.

- **Decision 2: Veri Kaynağı & Çevrimdışı / Canlı Bütünlük**
  - *Chosen Approach*: Raporda veri toplanırken, hem `state.examHalls` ve `seatingPlan` hem de `attendances` (yerel önbellek + Firestore `schools/main/attendances`) birleştirilir. Henüz yoklama alınmamış salonlar "Yoklama Bekleniyor" durumunda gösterilir.
  - *Why*: Eğer bir öğretmen henüz bildirim butonuna basmadıysa idareci hangi salonun geciktiğini hemen tespit edip müdahale edebilir.

- **Decision 3: Sınıf Bazlı Gruplama Algoritması**
  - *Chosen Approach*: Devamsız öğrenci listesi, öğrencilerin `studentClass` veya `classStr + sectionStr` alanlarına göre otomatik olarak ayrıştırılır ve şube adına göre (8-A, 8-B, 8-C...) alfabetik dizilir.
  - *Why*: e-Okul sisteminde devamsızlık girişi şube şube yapılır. Salona göre liste e-Okul girişinde zorluk yaratırken, şubeye göre liste idarecinin işini 5 kat hızlandırır.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HallsView (Salonlar & Oturma)                   │
│                                                                        │
│   [+ Yeni Salon]  [Dışa Aktar]  [📊 Sınav Yoklama Raporu (YENİ)]       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Tıklandığında
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  AttendanceReportModal Component                       │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Üst Bar: [Sınav Seçimi ▼]   [📥 Excel İndir]   [🖨️ Yazdır / PDF] │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 4 Özet Metrik:                                                   │  │
│  │ [Toplam Öğrenci] [Gelenler %] [Gelmeyenler %] [Salon Teslimatı]   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Sekmeler: [🏢 Salona Göre Dağılım]  [🎓 Sınıfa Göre Devamsızlar] │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Veri Tablosu:                                                    │  │
│  │ - Salon Adı / Gözetmen / Devamsız Listesi (No, Ad, Sınıf, Sıra)  │  │
│  │ - VEYA Sınıf Adı / Devamsız Öğrenciler / Bulunduğu Salon         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & Helper Mapping**:
  - `HallAttendanceReportItem`:
    - `examId`: string
    - `examName`: string
    - `hallId`: string
    - `hallName`: string
    - `takenBy`: string (gözetmen adı & e-postası)
    - `takenAt`: string
    - `status`: 'submitted' | 'pending'
    - `totalAssigned`: number
    - `presentCount`: number
    - `absentCount`: number
    - `absentStudents`: `AbsentStudentInfo[]`
  - `ClassAbsentSummary`:
    - `className`: string
    - `totalAbsent`: number
    - `students`: Array<{ studentNo: number; studentName: string; hallName: string; deskNumber: number }>

- **Excel & Print Formatları**:
  - `Excel`: Başlık bilgileri (Sınav Adı, Tarih, Okul), Salon Özeti sayfası ve Sınıf Devamsızlık Listesi sayfası (veya tek düzenli sayfa) formatında temiz sütunlarla dışa aktarılır.
  - `Print / PDF`: Yazıcı dostu `@media print` CSS kuralları ile sayfa başı resmi sınav başlığı, salon gözetmenleri çizelgesi ve müdür/komisyon imza onay kutusu içerir.
