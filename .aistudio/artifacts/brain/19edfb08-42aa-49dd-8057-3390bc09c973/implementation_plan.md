# Otomatik Arka Plan Oturum Kalıcılığı ve Google Drive Kütük Senkronizasyonu Planı

Öğretmenlerin mobil cihazlarında her oturum açışta tekrar onay verme yükünü ortadan kaldırmak için, bir kez verilen Google ve Firebase yetkilerini süresiz yerel oturum kalıcılığı ile saklayan, arka planda her 5 dakikada bir ve sayfa odağında sessizce en güncel "Akademi Panel Drive Kütüğü"nü indiren ve ağ kesintilerinde yerel önbellekten kesintisiz çalışan otomatik sistem mimarisi.

## User Review & Critical Decisions

> [!IMPORTANT]
> Aşağıdaki tüm ürün ve mimari kararlar, yapılan netleştirme soruları doğrultusunda onaylanmıştır.

- **Onaylanan Karar 1 (Oturum Kalıcılığı & İzin Yenileme):** Google Drive erişim simgesi ve kullanıcı oturum bilgileri `browserLocalPersistence` ve `localStorage` üzerinde süresiz saklanacak; yetki süresi bittiğinde arka planda sessizce yenilenecektir.
- **Onaylanan Karar 2 (Arka Plan Senkronizasyon Sıklığı):** En güncel canlı kütük dosyası her 5 dakikada bir ve sayfa odağı değiştikçe (`window.onfocus`) arka planda kontrol edilip otomatik indirilecektir.
- **Onaylanan Karar 3 (Çevrimdışı/Ağ Kesintisi Mimarisi):** Ağ kesintisi durumunda en son indirilen kütük verisi yerel önbellekten (`localStorage` / `IndexedDB`) yüklenip kullanıcıya kesintisiz sunulacaktır.

---

## 1. Overview & Core Concept

- **Ne Yapıyor**: Öğretmen kullanıcıların mobil veya masaüstü cihazlarında tekrar tekrar "Drive Bağlan / İzin Ver" butonuna basma zorunluluğunu kaldırır. İlk onay verildikten sonra oturumu cihaz hafızasında güvenli bir şekilde muhafaza eder ve her 5 dakikada bir arka planda Google Drive üzerindeki en güncel okul canlı kütüğünü sessizce indirir.
- **Hedef Kitle**: Mobil cihaz kullanan öğretmenler, okul yöneticileri ve sınav değerlendirme görevlileri.
- **Sağlanan Temel Değer**: Sıfır manuel tıklama gereksinimi, kesintisiz çevrimdışı çalışma kabiliyeti ve en güncel öğrenci/sınav verilerine arka planda anında erişim.

---

## 2. User Experience & Visual Design

- **Kullanıcı Akışı**:
  1. Öğretmen ilk kez giriş yaptığında Google/Firebase yetkisini verir.
  2. Sistem token ve oturum anahtarını yerel güvenli depolamaya kaydeder.
  3. Uygulama açılışında arka planda indirme durumu küçük, göz yormayan yeşil bir canlılık rozetiyle (`Drive Senkronize`) gösterilir.
  4. 5 dakikalık periyotlarla veya sekmeye her dönüldüğünde en güncel kütük versiyonu kontrol edilir; yeni veri varsa ekran duraklamadan arka planda güncellenir.
  5. İnternet koptuğunda kullanıcı uyarılardan rahatsız edilmez, en son indirilen canlı kütük ile çevrimdışı çalışmaya devam edilir.

- **Görsel Tematik & Rozet Tasarımı**:
  - *Sessiz Arka Plan Rozeti*: Sağ üst köşede veya alt bilgi çubuğunda "Drive Güncel • 5d Otomatik" rozeti.
  - *Yenileme İndikatörü*: Sadece güncelleme sırasında dönen küçük bir yeşil senkronizasyon halkası.
  - *Çevrimdışı Postür*: İnternet gittiğinde turuncu "Çevrimdışı Mod (Son Kütük Aktif)" bilgisi.

---

## 3. Key Product Decisions & Trade-Offs

- **Süresiz Oturum Kalıcılığı (Browser Local Persistence + Persistent Token Refresher)**:
  - *Seçilen Yaklaşım*: `setPersistence(auth, browserLocalPersistence)` ve `localStorage` üzerinde süre sınırsız erişim simgesi önbelleklemesi.
  - *Neden*: Öğretmenlerin mobil tarayıcıda sürekli popup onay ekranıyla karşılaşmasını %100 engeller.
- **5 Dakikalık Arka Plan Kontrolü (Interval + Focus Triggers)**:
  - *Seçilen Yaklaşım*: `setInterval(5 * 60 * 1000)` ve `window.addEventListener('focus')`.
  - *Neden*: Aşırı ağ trafiği yaratmadan en güncel kütük versiyonunu yakalar.
- **Yerel Önbellek Öncelikli (Cache-First Offline Fallback)**:
  - *Seçilen Yaklaşım*: Her başarılı indirmede `akademi_data_snapshot_cache` güncellenir.
  - *Neden*: Okul bodrum katlarında veya zayıf mobil çekim alanlarında öğretmenlerin sınav okuma ve sonuç görmesini kesintisiz kılar.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ÖĞRETMEN MOBİL CİHAZI                           │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │ LocalStorage / Auth   │             │   Background Sync Engine   │  │
│  │ Persistent Token      │────────────>│   (Every 5 min / Window    │  │
│  │ & Approved State      │             │    Focus Trigger)          │  │
│  └───────────────────────┘             └──────────────┬─────────────┘  │
│                                                       │                │
│                                                       │ (Fetch File)   │
│                                                       ▼                │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │ Local Master Cache    │<────────────│ Google Drive API /         │  │
│  │ (Offline Fallback)    │ (Auto Save) │ Express RAM Proxy          │  │
│  └───────────────────────┘             └──────────────┴─────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

- **Mimaride Yapılacak Güncellemeler**:
  1. `src/lib/firebase.ts`: `getCachedAccessToken`, `connectGoogleDrive` ve token depolama mantığı `localStorage` ile kalıcı hale getirilecek, sessiz yenileme mekanizması kurulacak.
  2. `src/context/AppContext.tsx`: `checkDriveRemoteUpdate` periyodu 30s yerine 5 dakikaya optimize edilecek, açılışta ve sekme odağında otomatik arka plan indiricisi entegre edilecek.
  3. `src/App.tsx`: Öğretmen oturumlarında manuel onay ekranı yerine sessiz arka plan yükleme akışı etkinleştirilecek.
