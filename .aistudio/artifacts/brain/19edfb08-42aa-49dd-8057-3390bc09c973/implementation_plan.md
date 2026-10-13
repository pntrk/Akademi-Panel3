# Sınav Bazlı Bağımsız Yoklama ve Arşiv Raporlama Uygulama Planı

## 1. Genel Bakış ve Amaç
Mevcut yoklama sisteminde, yeni bir sınav açıldığında ilgili salona ait eski bir sınavın devamsız listesi yanlışlıkla devralınabilmekte (fallback record mantığı nedeniyle) ve sınavlar arası yoklama izolasyonu tam sağlanamamaktadır.

Kullanıcı tercihlerine uygun olarak:
1. **Yoklama İzolasyonu:** Her sınavın yoklaması tamamen o sınava özel (`${examId}_${hallId}`) olacak; önceki sınavların verileri sonraki sınavlara kesinlikle taşınmayacak/gösterilmeyecek.
2. **Otomatik Günün Sınavı & Modalda Değiştirme:** Salonda yoklama açıldığında takvim/bugünün sınavı otomatik seçilecek; ancak modal başlığında bulunan sınav seçici (dropdown) ile kullanıcı dilediğinde salona atanmış diğer sınavları veya tüm aktif sınavları seçip o sınava ait yoklama durumunu yönetebilecek.
3. **Sınava Özel Arşiv ve Raporlama:** `AttendanceReportModal` bileşeninde her sınav bağımsız olarak raporlanacak, üst kısımdaki sınav arşivi / seçici ile geçmiş ve güncel sınavlar arasında anında geçiş yapılabilecek.

---

## 2. Mevcut Sorunun Kök Neden Analizi

1. **`HallsView.tsx` Fallback Record Mantığı (Satır ~456):**
   ```ts
   const existingKey = matchedExam ? `${matchedExam.id}_${hall.id}` : '';
   const existingRecord = existingKey ? attendances[existingKey] : undefined;
   const fallbackRecord = (Object.values(attendances) as HallAttendance[]).find(a => a.hallId === hall.id);
   const targetRecord = existingRecord || fallbackRecord; // <-- HATA: Yeni sınavda önceki sınavın yoklaması yükleniyor!
   ```
   Bu fallback kaldırılmalı, yalnızca seçili sınava ait kayıt (`existingRecord`) okunmalıdır. Eğer o sınav için yoklama henüz alınmadıysa liste boş (`[]`) başlamalıdır.

2. **Oturma Planı Görünümündeki Devamsız Öğrenci Tespiti (Satır ~501):**
   `savedAbsentStudentIds` fonksiyonu sadece en son kaydedilen yoklamayı çekmektedir. Bunun yerine salonda aktif seçili olan sınava ait yoklamadaki devamsız öğrencileri filtrelemelidir.

3. **Yoklama Modalında Sınav Değiştirici Eksikliği (Satır ~2197):**
   Şu anda sınav adı salt-okunur bir etiket olarak gösterilmektedir. Burası, kullanıcının gerekirse sınavı değiştirebileceği şık ve sezgisel bir açılır menü (dropdown) haline getirilecektir. Sınav değiştirildiğinde o sınava ait mevcut yoklama verisi anında yüklenecektir.

4. **`AttendanceReportModal.tsx` Raporlama Yapısı:**
   Raporlama modali seçilen sınava göre verileri filtrelemektedir, ancak sınavlar arası geçiş deneyimi, arşivden sınav seçme göstergesi ve sınava özel yoklama yüzdeleri/özetleri daha belirgin ve filtrelenebilir hale getirilecektir.

---

## 3. Yapılacak Değişiklikler ve Adımlar

### Adım 1: Yoklama Veri Katmanının İzolasyonu (`src/lib/attendance.ts` & `src/views/HallsView.tsx`)
- `HallsView.tsx` içerisindeki `targetRecord = existingRecord || fallbackRecord` mekanizması kaldırılacak.
- Yoklama modalı açıldığında:
  - Eğer `activeExamForAttendance` varsa ve o sınav için önceden gönderilmiş bir yoklama varsa o yüklenecek.
  - Eğer o sınav için yoklama alınmamışsa, devamsız listesi tertemiz (`[]`) açılacak.
- `savedAbsentStudentIds` hook'u aktif sınav ID'sine göre filtrelenecek.
- Sınav kaydı gönderilirken (`handleSaveAttendance`) kesin olarak `activeExamForAttendance.id` ile anahtarlanacak (`${activeExam.id}_${hall.id}`).

### Adım 2: Yoklama Modalında Dinamik Sınav Seçici (`HallsView.tsx`)
- Yoklama kontrol çubuğunda (`modalMode === 'attendance'`), sınav başlığı etkileşimli bir sınav seçiciye dönüştürülecek:
  - Otomatik olarak günün sınavı / ilgili salona atanmış ilk sınav seçili gelecek.
  - Yanında açılır menü veya sınav değiştirme butonu yer alacak.
  - Kullanıcı listeden başka bir sınav seçtiğinde:
    - `activeExamForAttendance` güncellenecek.
    - O sınava ait kayıtlı yoklama varsa devamsız listesi anında güncellenecek, yoksa sıfırlanacak.
    - Kullanıcıya "Şu an [Sınav Adı] yoklamasını alıyorsunuz" bildirimi açıkça gösterilecek.

### Adım 3: Salon Kartlarında ve Başlıkta Sınav Durumu Göstergesi
- Salon kartlarında ve salon listesi üst panelinde hangi sınavın yoklama durumunun gösterildiği netleştirilecek.
- Salon listesi başlığına veya filtre alanına aktif sınav seçimi desteği güçlendirilecek; böylece farklı gün/oturum sınavlarının yoklama durumları birbirine karışmayacak.

### Adım 4: Yoklama Raporu ve Arşiv Seçimi (`src/components/AttendanceReportModal.tsx`)
- Rapor modalının üst kısmındaki sınav seçici alanı "Sınav Arşivi" başlığıyla daha görünür ve kategorize (Tarihe göre sıralı, geçmiş ve güncel) hale getirilecek.
- Her sınav için bağımsız yoklama istatistikleri, salondaki mevcut/devamsız sayıları ve e-Okul devamsız aktarım listesi sınav bazlı tam izolasyonla sunulacak.
- Başka bir sınav seçildiğinde önceki sınavın salon/devamsız verileri tamamen temizlenip sadece seçilen sınavın verileri listelenecek.

---

## 4. Doğrulama ve Test Kriterleri
1. **Sınav A ve Sınav B Testi:**
   - Sınav A için bir salonda yoklama alınıp 2 öğrenci devamsız işaretlenip kaydedilecek.
   - Sınav B açıldığında devamsız listesi tamamen boş ve sıfır devamsızla açılacak.
   - Sınav A tekrar açıldığında önceki 2 devamsız öğrenci korunmuş olarak görüntülenecek.
2. **Modal İçi Sınav Değiştirme:**
   - Yoklama modalı açıkken sınav seçiciden Sınav A'dan Sınav B'ye geçildiğinde arayüz hatasız güncellenecek.
3. **Yoklama Raporu:**
   - Yoklama raporunda Sınav A seçildiğinde yalnızca Sınav A devamsızları, Sınav B seçildiğinde yalnızca Sınav B sonuçları gösterilecek; Excel ve yazdırma çıktıları da sınava özel olacak.
4. **Kod Derleme & Lint Kontrolü:** `compile_applet` ve `lint_applet` ile sıfır hata doğrulaması yapılacak.
