# Karanlık Tema Kapsamlı Görsel & Kontrast İyileştirme Planı

Kullanıcı tercihleri doğrultusunda, tüm uygulama genelinde **gece mavisi ve zengin lacivert tonları** temel alınarak yüksek kontrastlı, göz yormayan ve modern bir karanlık tema tasarımı hayata geçirilecektir.

---

## 1. Mimari & Renk Paleti Standartları (Gece Mavisi / Lacivert)

* **Ana Sayfa & Kanvas Zemin:** `#0B0F19` (Derin Gece Mavisi / Slate-950)
* **Birincil Kartlar & Paneller:** `#111827` (Zengin Lacivert / Gray-900) ve `#0F172A` (Slate-900)
* **İkincil / Vurgu Kartları & Hover:** `#1E293B` (Derin Arduvaz / Slate-800) ve `#1E1B4B` (Hafif İndigo dokunuşlu lacivert)
* **Kenarlıklar (Borders):** `border-slate-800` (`rgba(51, 65, 85, 0.7)`), `border-indigo-500/20` ve `border-slate-700/80` (Daha belirgin ve keskin hatlar)
* **Metin Hiyerarşisi:**
  * Başlıklar & Kritik Veriler: `text-white`, `text-slate-100`
  * Gövde & Açıklamalar: `text-slate-300` (Okunurluğu yüksek, net ton)
  * Yardımcı & İkincil Etiketler: `text-slate-400` (Boğulmayan, dengeli kontrast)
* **Vurgu & Durum Renkleri:**
  * Aktif/Seçili: Canlı İndigo (`#6366F1`) & Gök Mavisi (`#38BDF8`)
  * Başarı: Zümrüt Yeşili (`#34D399`)
  * Uyarı/Bilgi: Canlı Kehribar (`#FBBF24`) & Mavi (`#60A5FA`)

---

## 2. Kapsam ve Yapılacak İyileştirmeler

### A. Küresel Stil & CSS Düzenlemesi (`src/index.css`)
- `dark` sınıfı aktif olduğunda gövde (`body`) ve kök elemanlar için temel gece mavisi arka plan (`bg-[#0B0F19] text-slate-100`) standardının tanımlanması.
- Kaydırma çubuklarının (scrollbars) karanlık modda gece mavisi ile uyumlu ince ve zarif bir görünüme kavuşturulması.
- Form elemanları (input, select, textarea) için küresel karanlık tema stillerinin pekiştirilmesi.

### B. Ana Düzen & Kenar Çubuğu (`src/components/Layout.tsx`)
- Masaüstü ve mobil kenar çubuğunun gece mavisi tonlarıyla derinleştirilmesi (`bg-[#0d111c] border-slate-800`).
- Aktif sekme göstergelerinin zengin mavi/indigo vurgusuyla daha belirgin hale getirilmesi.
- Tema değiştirme (Gündüz/Gece) butonunun ve profil/ayarlar modalının gece mavisi zeminine uyumlu hale getirilmesi.

### C. Sayfa Kartları, Tablolar ve Veri Göstergeleri
- Tüm modüllerde (Öğrenci Yönetimi, Sınav Planlama, Oturma Düzeni, İstatistikler vb.) yer alan kartların arkaplan ve kenarlık kontrastlarının artırılması.
- Tablolarda satır zebra desenleri, başlık alanları ve fareyle üzerine gelme (hover) durumlarının gece mavisi tonlarında netleştirilmesi.
- Veri rozetleri (badge), etiketler ve durum bildirimlerinin karanlık modda parlamadan net okunabilir kılınması.

### D. Modallar ve Açılır Pencereler
- `CloudBackupModal.tsx`, Ayarlar penceresi ve onay diyaloglarının arka planlarının koyu lacivert katmanlarla (`bg-[#0F172A] border-slate-700`) yeniden dengelenmesi.
- Butonların (Kaydet, İptal, İndir, Eşitle) karanlık moddaki kontrast ve odak durumlarının kusursuzlaştırılması.

---

## 3. Doğrulama ve Test Adımları
1. **Derleme & Hata Denetimi:** `compile_applet` ve `lint_applet` ile tüm TypeScript ve stil kontrolleri gerçekleştirilecek.
2. **Karanlık Mod Geçiş Testi:** Hem aydınlık hem karanlık mod geçişleri yapılarak hiçbir alanın soluk, silik veya beyaz zeminde takılı kalmadığı doğrulanacak.
3. **Okunabilirlik & Kontrast Kontrolü:** Form alanları, tablo metinleri ve durum rozetlerinin yüksek kontrastlı gece mavisi zemininde net okunurluğu teyit edilecek.
