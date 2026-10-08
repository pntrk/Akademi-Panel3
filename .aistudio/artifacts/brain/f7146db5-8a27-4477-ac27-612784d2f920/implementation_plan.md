# Dinamik Google Drive Kütük Yayını ve Öğretmen Senkronizasyonu Planı

Bu plan, `.teacher_broadcast_cache.json` dosyasının kod tabanında oluşturulması ve güncellenmesi sorununu kökten çözerek; verilerin tamamen dinamik olarak **kilitli Google Drive kütük dosyası** üzerinden öğretmenlere yayınlanmasını ve öğretmenlerin panele girdiğinde en güncel kütük verisini otomatik olarak görüntülemesini sağlar.

---

## 1. Tespit Edilen Problem ve Nedenleri
1. **Kod Tabanında `.teacher_broadcast_cache.json` Dosyası Oluşması:**
   - `server.ts` içerisindeki `/api/teacher-broadcast/update` uç noktası `fs.writeFile(CACHE_FILE, ...)` ile yerel diskte dosya oluşturmaktadır.
   - Bu durum git değişikliklerine ve kod tabanında gereksiz dosya kirliliğine yol açmaktadır; sunucusuz (serverless) ortamlarda ise disk kalıcı değildir.
2. **Kilitli Google Drive Dosyası ile Dinamik İletişim:**
   - Kilitli Google Drive linki/ID'si kütüphane kütüğünün tek gerçek kaynak (Single Source of Truth) noktasıdır.
   - Öğretmenlerin diske yazılan statik bir json yerine, adminin yayınladığı güncel kilitli Google Drive dosyasından doğrudan ve dinamik veri çekmesi gerekmektedir.
3. **Öğretmen İzin ve Görünüm Ayrımı:**
   - Öğretmen panelinde karmaşık teknik Google Drive link veya ID girişleri görünmemeli, arka planda güvenle okunmalı ve öğretmenlere yalnızca sade, otomatik güncellenen veriler sunulmalıdır.

---

## 2. Yapılacak Değişiklikler

### A. Sunucu Tarafı (`server.ts`)
- **Disk Yazımının Kaldırılması:**
  - `fs.writeFile(CACHE_FILE, ...)` ve `CACHE_FILE` değişkeni tamamen kaldırılacak.
  - Kod tabanındaki mevcut `.teacher_broadcast_cache.json` dosyası silinecek ve `.gitignore` dosyasına eklenecektir.
- **Dinamik Google Drive & Bellek Uç Noktası:**
  - `/api/teacher-broadcast` GET uç noktası diski okumak yerine; Firestore'daki kilitli canonical Google Drive ID'sini alarak `/api/drive-proxy` üzerinden doğrudan Google Drive'dan güncel JSON verisini dinamik olarak getirecek.
  - `/api/teacher-broadcast/update` POST uç noktası diske dosya yazmayacak, yalnızca Firestore ve bellek senkronizasyonu yapacak.

### B. Google Drive Entegrasyonu (`src/services/googleDriveService.ts`)
- Admin **"Öğretmene Yayınla"** butonuna bastığında:
  - Veriler doğrudan sistemde kilitli olan canonical Google Drive dosyasına (`kutuphane_canli_kutuk.json`) kaydedilecek.
  - Dosyanın Google Drive okuma izinleri öğretmenlerin erişebilmesi için `reader` (herkese açık salt-okunur veya izinli) olarak doğrulanacak.
  - Firestore'a (`schools/main/modules/meta` ve `teacher_broadcast`) dosya ID'si, son yayınlama zamanı ve admin damgası yazılacak.
  - Diske dosya yazma çağrısı iptal edilecek.

### C. Öğretmen Paneli ve Otomatik Senkronizasyon (`src/App.tsx`, `src/components/TeacherDashboard.tsx`)
- **Otomatik Veri Çekme:**
  - Öğretmen oturum açtığında veya paneli açtığında sistem kilitli Google Drive kütük dosyasını otomatik olarak sorgulayacak ve en güncel kitap/öğrenci verilerini getirecektir.
  - Bir kütük güncellemesi olduğunda öğretmen arayüzünde "Kütük Güncellendi" bilgilendirmesi ile veriler anında yenilenecektir.
- **Arayüz Sadeleştirme (Kullanıcı Tercihi Doğrultusunda):**
  - Öğretmen ekranında kilitli Google Drive linki, URL veya ID giriş kutuları tamamen gizlenecektir.
  - Yalnızca "Canlı Kütük Senkronize (Google Drive)" rozeti ve son senkronizasyon zamanı yer alacaktır.

---

## 3. Doğrulama ve Test Planı
1. **Kod Tabanı Kontrolü:**
   - `.teacher_broadcast_cache.json` dosyasının silindiği ve diske yazma işlemi yapılmadığı doğrulanacak.
2. **Admin Yayınlama Testi:**
   - Kilitli Google Drive kütüğüne "Öğretmene Yayınla" işlemi gerçekleştirilerek Google Drive'daki dosyanın güncellendiği ve diske hiçbir dosya yazılmadığı teyit edilecek.
3. **Öğretmen Dinamik Erişim Testi:**
   - Öğretmen rolüyle giriş yapıldığında kilitli Google Drive dosyasından dinamik verinin hatasız yüklendiği ve arayüzde link detaylarının gizlendiği test edilecek.
4. **Derleme Doğrulaması:**
   - `compile_applet` ile sıfır TypeScript / Vite hatası teyit edilecek.
