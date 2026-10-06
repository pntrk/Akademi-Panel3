# "Öğretmene Yayınla" Tabanlı Google Drive & Sunucu Yayın Mimarisi

Adminin "Öğretmene Yayınla" butonuyla Google Drive'daki en son öğrenci kütük yedeğini öğretmenlerin okuma erişimine açtığı ve öğretmenlerin giriş anında bu güncel yedeği otomatik çektiği hibrit mimari.

> [!IMPORTANT]
> **Kullanıcı Talebi Doğrultusunda Netleşen Akış**:
> 1. **"Öğretmene Yayınla" Butonu**: Admin panelinde yer alan tek tık butonudur. Tıklandığında:
>    - Google Drive üzerindeki kilitli kütük yedeğinin en son sürümü (`AkademiPanel_Canli_Kutuk.json`) hazırlanır.
>    - Google Drive Permissions API çağrılarak dosyanın öğretmenler için salt okunur yetkisi garantilenir.
>    - Eşzamanlı olarak Express sunucu önbelleği bu güncel yedekle mühürlenir ve son yayın tarihi (örn. `06.10.2026 19:45`) güncellenir.
> 2. **Öğretmen Kullanıcı Girişi**:
>    - Öğretmen Firebase Google Girişi ile giriş yaptığında, arka planda yayınlanmış son güncel kütük yedeği otomatik olarak çekilir.
>    - Öğretmen arayüzü yalnızca 3 ana menüyü (**Sınav Salonları**, **Sınav Sonuçları**, **Lig & Arena**) salt okunur açar.
> 3. **Firebase Etkileşim Kanalı**:
>    - **Yoklamalar**: Öğretmen sınav salonunda yoklamayı işaretleyip "Admine Gönder" dediğinde Firebase üzerinden admine ulaşır.
>    - **Bildirimler**: Okul bildirimleri Firebase üzerinden anlık iletilmeye devam eder.

---

## 1. Genel Bakış ve Mimarinin Amacı

Firebase Spark kotalarını sıfırda tutarken adminin veri yayın kontrolünü elinde tutmasını sağlamak:
- Admin sınavları hazırlar, salonları oluşturur, öğrenci puanlarını düzenler.
- Admin hazır olduğunda **"📢 Öğretmene Yayınla"** butonuna tıklar.
- Google Drive kütüğü mühürlenir ve yayınlanır.
- Öğretmenler uygulamaya girdiklerinde hiçbir ek işlem yapmadan adminin yayınladığı son güncel paketi görürler.

---

## 2. Kullanıcı Deneyimi ve Arayüz Akışı (UX & Visual Design)

### Admin Rolü Akışı
- **Üst Çubukta "Öğretmene Yayınla" Butonu**:
  - `Header` ve `CloudBackupModal` üzerinde belirgin, yeşil/zümrüt tonlarında, roket veya yayın simgeli buton:
    - `[ 📢 Öğretmene Yayınla ]`
  - Tıklandığında anlık olarak Google Drive kütüğünü eşitler, yetkiyi açar, sunucu önbelleğini günceller ve bildirim verir:
    - *"✓ Son kütük yedeği başarıyla yayınlandı! Öğretmenler artık bu güncel sürümü (v{sürüm} - {tarih}) görecek."*
- **Yayın Durumu Rozeti**: Üst barda son yayınlanma tarihi ve saati (örn. `Son Yayın: 06.10.2026 19:40`) sürekli görünür.

### Öğretmen Rolü Akışı
- **Firebase Google Girişi**: Öğretmen e-postası ile oturum açılır.
- **Açılışta Otomatik Veri Yükleme**:
  - Açılış animasyonunda: *"Yayınlanmış son güncel kütük yedeği yükleniyor..."* mesajı görünür.
  - Express sunucusu `/api/teacher-data` üzerinden yayınlanmış son kütüğü sıfır gecikmeyle döner.
- **Sol Menü (Yalnızca 3 Yetkili Menü)**:
  1. 🏢 **Sınav Salonları**: Salon oturma düzeni, gözetmenler, öğrenci sıraları.
  2. 📊 **Sınav Sonuçları**: Deneme sınav sonuçları, netler, karne görünümleri.
  3. 🏆 **Lig & Arena**: Sınıf ve bireysel lig puanları, dereceler ve mentorlar.
- **Sınav Salonu Yoklama Düğmesi**:
  - Sınav salonu ekranında gözetmen öğretmen için `[ 📋 Salon Yoklamasını Tamamla & Admine İlet ]` butonu.
  - Bu veri Firebase Firestore üzerinden admine 1 saniyede ulaşır.
- **Yazma Koruması**:
  - Öğretmen Google Drive kütüğüne asla yazamaz. Düzenleme, silme veya öğrenci ekleme araçları arayüzde yer almaz.

---

## 3. Veri Akışı ve Yetkilendirme Modeli

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ADMIN KULLANICI                               │
│  - Öğrenci, sınav, salon ve lig verilerini düzenler                     │
│  - "Öğretmene Yayınla" Butonuna Basar ───┐                             │
└──────────────────────────────────────────┼──────────────────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                             │
                    ▼                                             ▼
┌───────────────────────────────────────┐     ┌───────────────────────────────────┐
│     GOOGLE DRIVE CANLI KÜTÜĞÜ         │     │    EXPRESS SUNUCU RAM ÖNBELLEĞİ   │
│  - Son sürüm JSON kaydedilir          │     │  - `/api/teacher-data` güncellenir│
│  - Öğretmen okuma izni mühürlenir     │     │  - Son yayın tarihi kaydedilir    │
└───────────────────────────────────────┘     └─────────────────┬─────────────────┘
                                                                │
                                                                │ (Girişte Otomatik İndirme)
                                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ÖĞRETMEN KULLANICILAR                                   │
│  - Firebase Google Girişi ile oturum açar                                       │
│  - Açılışta yayınlanmış son yedeği otomatik çeker (<50ms)                      │
│  - Sadece 3 Menü: 1. Salonlar  2. Sonuçlar  3. Lig & Arena                      │
│  - Yoklamaları Firebase ile Admine İletir                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Teknik Entegrasyon Ayrıntıları

### 1. "Öğretmene Yayınla" Butonunun Mantığı (`src/lib/googleDrive.ts` & `src/context/AppContext.tsx`)
```typescript
// Admin "Öğretmene Yayınla"ya bastığında:
1. syncLiveMasterToGoogleDrive(state, userEmail) // Sabit Drive kütüğünü günceller
2. makeFilePubliclyReadable(canonicalFileId, driveToken) // Drive permissions API: reader role
3. fetch('/api/teacher-broadcast/update', { method: 'POST', body: JSON.stringify(safePayload) }) // Sunucu önbelleğini yeniler
4. setLastTeacherPublishedDate(new Date().toISOString()) // Yerel ve sunucu durumuna kaydeder
```

### 2. Öğretmen Girişinde Otomatik Kütük Çekme (`src/context/AppContext.tsx`)
```typescript
// Öğretmen giriş yaptığında:
if (userRole === 'teacher') {
  // 1. Firestore büyük koleksiyon dinleyicilerini kapat (0 Firestore okuması)
  // 2. Sunucudan yayınlanmış en son güncel yedeği al:
  const res = await fetch('/api/teacher-data');
  const publishedBackup = await res.json();
  setState(sanitizeSchoolState(publishedBackup.data));
  // 3. Yalnızca bildirim ve salon yoklaması için Firebase'i dinle
}
```

### 3. Yoklama Akışı (Firebase Firestore)
- Öğretmen salonda yoklamayı girdiğinde `exam_attendance` koleksiyonuna belge yazar (`setDoc`).
- Admin ekranında `onSnapshot(collection(db, 'exam_attendance'))` dinler ve gelen yoklamaları anında görür.

---

## 5. Uygulama ve Doğrulama Adımları

1. **Sunucu Uç Noktaları (`server.ts`)**:
   - `/api/teacher-data` (GET): Yayınlanmış son yedeği döndürür.
   - `/api/teacher-broadcast/update` (POST): Adminin yayınladığı son yedeği sunucu RAM'ine alır.
2. **"Öğretmene Yayınla" Butonu & Mantığı**:
   - `Header.tsx` ve `CloudBackupModal.tsx` üzerine "Öğretmene Yayınla" butonu ve son yayın tarihi göstergesi.
   - Fonksiyonun Google Drive okuma iznini (`reader`) garanti altına alması.
3. **Öğretmen Açılış Akışı & Menü Kısıtlamaları**:
   - `AppContext.tsx`: Öğretmen oturum açtığında yayınlanan son yedeğin sıfır Firestore kotasıyla çekilmesi.
   - `Layout.tsx`: Öğretmen için sadece Sınav Salonları, Sınav Sonuçları ve Lig & Arena sekmelerinin sunulması, tüm yazma aksiyonlarının gizlenmesi.
4. **Yoklama Modülü Entegrasyonu**:
   - Öğretmenin sınav salonunda yoklamayı Firebase üzerinden admine tek tıkla iletmesi.
5. **Derleme ve Test**:
   - Admin tarafından yayınlama -> Öğretmen girişi -> Anında güncel kütük görünümü testleri.
