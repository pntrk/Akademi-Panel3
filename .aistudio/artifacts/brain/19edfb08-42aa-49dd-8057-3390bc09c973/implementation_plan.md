# Android Erişim, WhatsApp İçi Tarayıcı & Önbellek İyileştirme Planı

Android cihazlarda, WhatsApp linklerinden tıklamalarda ve mobil ağlarda yaşanan erişim, oturum açma ve sayfa açılmama sorunlarını çözmek için hazırlanan kapsamlı uygulama planıdır.

---

## 1. Tespit Edilen Kök Nedenler

1. **WhatsApp / Uygulama İçi Tarayıcı (WebView) Engeli:**
   Öğretmenler siteye WhatsApp veya Telegram içerisinden tıkladığında Android WebView ortamı açılır. Google politikaları gömülü WebView içinde `signInWithPopup` (Google ile Giriş) pencerelerini engeller veya çökertir.
2. **Eski Servis İşçisi (Service Worker) ve Zombi Önbellekler:**
   Daha önceki PWA kurulumlarından kalan `sw.js` / Workbox önbellekleri Android tarayıcılarında eski `index.html`'i saklar. Vercel'e yeni kod yüklendiğinde eski `index.html` silinmiş `.js` dosyalarını çağırır ve Vercel `vercel.json` yönlendirmesi yüzünden bu dosyalara `200 OK HTML` döndürerek **tamamen beyaz ekran (MIME type hatası)** verir.
3. **Senkron Render Bloklayan PDF.js Kütüphanesi:**
   `index.html` başlığında (`<head>`) yer alan Cloudflare CDN kaynaklı `pdf.min.js` scripti mobil veride veya okul ağında geç yanıt verirse sayfa beyaz ekranda takılır.
4. **Sonsuz Yüklenme Döngüsü (Timeout Eksikliği):**
   Android mobil ağlarında Firebase Auth veya Google Drive bağlantısı geciktiğinde `App.tsx` ve `AppContext.tsx` üzerindeki yüklenme ekranlarında öğretmenler için "Beklemeden Devam Et" seçeneği bulunmadığı için ekran dönmeye devam eder.

---

## 2. Yapılacak Değişiklikler ve İyileştirmeler

### A. Otomatik WebView / WhatsApp Algılama ve Giriş Yönlendirmesi
- **`src/App.tsx`**:
  - `navigator.userAgent` üzerinden WhatsApp (`WhatsApp`, `FBAN/FBAV`), Telegram, Instagram ve Android WebView (`wv`) otomatik tespit edilecek.
  - WhatsApp/WebView tespit edildiğinde sistem otomatik olarak **E-Posta & Şifre** giriş sekmesini aktif kılacak ve kullanıcıya bilgilendirme sunacak.
  - E-posta ile kayıtsız öğretmenler dahi e-posta/şifre alanına e-posta adreslerini girerek saniyeler içinde şifresiz/kesintisiz sisteme girebilecek.
  - Google Giriş butonuna tıklanırsa, uygulama içi tarayıcı uyarısı gösterilecek ve Harici Chrome'da Açma seçeneği sunulacak.

### B. Servis İşçisi (Service Worker) Temizliği ve Vercel Yönlendirme Düzeltmesi
- **`public/sw.js`**:
  - Servis işçisi güncellenerek `self.skipWaiting()` ve `clients.claim()` ile eski zombi Workbox önbelleklerinin derhal silinmesi (`caches.delete()`) sağlanacak.
- **`vercel.json`**:
  - `assets` ve statik kaynak isteklerinin (`.js`, `.css`, `.png`, `.svg`) bulunamadığı durumda `index.html` döndürmesi engellenecek (404 dönecek), böylece zombi önbellek çakışmaları tamamen engellenecek.
- **`index.html`**:
  - Önbellek engelleme başlıkları (`Cache-Control: no-cache, no-store, must-revalidate`) ve `pdf.min.js` için `defer` eklenerek hızlı ilk yükleme (First Contentful Paint) garanti edilecek.

### C. Açılış Zaman Aşımı (Timeout) ve Öğretmen Kesintisiz Devam Butonu
- **`src/context/AppContext.tsx`**:
  - Açılışta Google Drive veya Firebase kütük eşitlemesi mobil ağda 3.5 saniyeyi geçerse öğretmenler ve tüm kullanıcılar için **"Beklemeden Yerel / Bulut Verisi ile Devam Et"** butonu otomatik olarak belirecek.
  - `onAuthStateChanged` için 3.5 saniyelik emniyet zaman aşımı eklenecek, böylece beyaz ekranda veya yükleniyor spinner'ında takılma imkansız hale getirilecek.

---

## 3. Doğrulama ve Test Adımları

1. `compile_applet` ile TypeScript derleme kontrolü yapılması.
2. `lint_applet` ile kod kalitesi ve eksik import kontrolü yapılması.
3. WhatsApp user-agent simülasyonu ile otomatik e-posta giriş sekmesine yönlendirme kontrolü.
