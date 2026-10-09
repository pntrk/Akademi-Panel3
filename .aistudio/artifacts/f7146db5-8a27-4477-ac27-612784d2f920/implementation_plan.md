# Öğrenci Detay Modalı Dinamik Rozet Senkronizasyon Planı

Öğrenci detay penceresinde üst rozet vitrini ile alt sınav listesi arasındaki tutarsızlığı gideren, seçili aya tam duyarlı dinamik rozet eşlemesi sağlayan ve kütükteki eski hayalet rozetleri temizleyen mimari revizyon.

### Kullanıcı Onaylı Kararlar & Tercihler

> [!IMPORTANT]
> Kullanıcı ile yapılan 1. aşama soru-cevap doğrultusunda şu kararlar kesinleştirilmiştir:
> - **Rozet Vitrini Kapsamı:** Öğrenci detay penceresindeki üst rozet vitrininde aktif filtre dönemi (örneğin seçili ay) rozetleri gösterilecek; alt sınav kartları ile birebir tutarlı olacak.
> - **Dinamik Veri Motoru:** Rozetler eski statik kütük kayıtlarından (`student.badges`) bağımsız olarak, sadece ve sadece sistemde aktif olarak yüklü sınav sonuçlarından dinamik üretilecek.

---

### 1. Sorunun Kök Nedeni ve Çözüm Özeti

1. **Kütükten Statik Miras (Hayalet Rozetler):** `LeagueView.tsx` içerisinde öğrenci rozet havuzu oluşturulurken başlangıçta `{ ...(s.badges || {}) }` alınmaktadır. Bu durum, silinmiş veya eski sınavlardan kalma rozetlerin sonsuza dek öğrenci üzerinde takılı kalmasına yol açmaktadır.
2. **Çift / Üç Kat Sayım (Double Counting):** Modal açıldığında `selectedStudent.allBadges` zaten tüm sınavları içermesine rağmen, modal içinde `rawHistory.forEach` döngüsüyle tüm sınav rozetleri bir kez daha üzerine eklenmektedir.
3. **Dönem Uyuşmazlığı:** Kullanıcı lig tablosunda belirli bir ayı (örneğin Ekim) seçtiğinde, Key Stats çubuğunda "Aylık LP" gösterilirken, üst rozet vitrininde tüm zamanların (ve mükerrer eklenmiş) rozetleri listelenmekte; alt sınav geçmişinde ise sadece o ay yapılan tek sınavın rozetleri gösterildiği için üst ve alt kısım tamamen farklı rozetler sergilemektedir.

---

### 2. Kullanıcı Deneyimi ve Arayüz Düzenlemeleri

- **Dönemsel Rozet Başlığı & Sayacı:**
  - Seçili ay aktifken (örneğin Ekim 2026): Başlıkta `🏅 Öğrencinin Kazandığı Rozetler (Ekim 2026)` ve rozet adedi yer alacak.
  - O ay tek bir deneme sınavı varsa, üst vitrindeki rozetler aşağıdaki tek sınavın kazandırdığı rozetlerle **%100 birebir aynı** olacak.
- **Hızlı Dönem / Tüm Zamanlar Geçişi:**
  - Kullanıcı isterse modal içerisinden "Bu Dönem ({N})" veya "Tüm Zamanlar ({T})" rozetlerini tek tıkla inceleyebilecek.
- **Sıfır Hayalet Rozet Garantisi:**
  - Sistemden bir sınav silindiğinde veya yeniden yüklendiğinde, kütükte kalan eski statik rozetler tamamen göz ardı edilip yalnızca güncel sınav sonuçları yansıtılacak.

---

### 3. Teknik Mimari ve Veri Akışı

```
┌────────────────────────────────────────────────────────┐
│             Sistemde Aktif Sınavlar                    │
│   (Deneme 1, Deneme 2, ... - Tarih ve Sonuçlar)       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│        Dinamik Ayrıştırma (Pure Dynamic Compute)       │
│  - allTimeBadges: {} (Tüm aktif sınavlardan)           │
│  - periodBadges:  {} (Seçili ay/dönem sınavlarından)   │
│  * Eski static student.badges ASLA dahil edilmez       │
└───────────────────────────┬────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌───────────────────────────┐ ┌───────────────────────────┐
│  Modal Üst Rozet Vitrini  │ │ Modal Alt Sınav Listesi   │
│  (periodBadges / X Rozet) │ │ (Sınav kartı rozetleri)   │
│  * Tam senkron ve tutarlı │ │ * Sınav bazlı döküm       │
└───────────────────────────┘ └───────────────────────────┘
```

---

### 4. Uygulama Adımları

1. **`LeagueView.tsx` Kütük Başlangıcının Temizlenmesi:**
   - `allStudentBadges` nesnesi `{ ...(s.badges || {}) }` yerine saf `{}` olarak başlatılacak; sadece `studentExams` sonuçlarından derlenecek.
2. **Modal İçi Rozet Havuzunun Düzeltilmesi:**
   - `rawHistory.forEach` ile yapılan kontrolsüz toplama kaldırılacak.
   - `periodBadges` (seçili ay sınavlarından toplanan rozetler) ve `allTimeBadges` (öğrencinin tüm sınavlarından toplanan rozetler) net bir şekilde ayrılacak.
   - Modal üst vitrininde varsayılan olarak seçili dönemin rozetleri gösterilecek, böylece alttaki sınav kartı ile tam birebir eşleşecek.
3. **Modal İçi Sekme Kontrolü:**
   - Üst vitrine dönemsel/tüm zamanlar gösterge etiketi eklenerek öğretmenin öğrencinin hem o ayki hem genel başarısını görebilmesi sağlanacak.
4. **Derleme ve Doğrulama:**
   - `compile_applet` ve `lint_applet` çalıştırılarak hatasız derlendiği doğrulanacak.
