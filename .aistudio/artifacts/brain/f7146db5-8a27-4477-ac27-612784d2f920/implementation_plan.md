# Akademi Arena (Lig & Rozetler) Arayüz Performans Optimizasyonu Planı

Akademi Arena görünümüne geçişteki kasma, donma ve gecikme problemlerini gidermek için hazırlanan performans ve mimari optimizasyon planı.

## Kullanıcı Tercihleri ve Analiz
- **Yükleme Yöntemi:** İlk 30 öğrenci gösterilecek, listenin altında **"Daha Fazla Göster"** butonu yer alacak.
- **Rozet Görünümü:** Öğrencilerin kazandığı tüm rozetler tabloda açık şekilde yan yana gösterilmeye devam edecek.
- **Kök Neden:** `baseStudents` hesaplamasında her öğrenci için tüm sınavların ve tüm sonuçların iç içe döngülerle (`O(N³)` karmaşıklık) tekrar tekrar taranması ve binlerce metin normalizasyonunun her render döngüsünde çalışması.

---

## Önerilen Değişiklikler

### 1. Veri Yapısı ve Hesaplama Optimizasyonu (`src/views/LeagueView.tsx`)
- **İndeksleme (Pre-indexing):**
  - Sınav sonuçlarını ve her öğrencinin katılım kayıtlarını tek bir geçişte (single-pass) `Map<studentKey, ExamRecord[]>` haritasına aktarma.
  - `baseStudents` hesaplamasındaki `filter` ve `map` döngülerini iç içe aramalar yerine `O(1)` zaman karmaşıklığına indirme.
- **İşlevsel Önbellekleme (Memoization Cleanup):**
  - `uniqueClasses` içindeki iç içe `.find()` aramalarını `Map` haritası ile hızlı eşlemeye dönüştürme.
  - Ağır seri ve LP hesaplamalarını sadece `state.exams` veya `state.results` değiştiğinde tetikleme.

### 2. Arayüz (DOM) Yükü ve Sayfalama Düzeltmesi
- **Kademeli Yükleme (Batching / Load More):**
  - `visibleCount` adında bir state eklenerek varsayılan olarak **30 öğrenci** listelenecek.
  - Tablonun ve mobil kart listesinin altında şık ve performanslı bir **"Daha Fazla Göster (+30 Öğrenci)"** butonu yer alacak.
  - Arama terimi, sınıf filtresi, ay seçimi veya takım filtresi değiştiğinde `visibleCount` otomatik olarak 30'a sıfırlanacak.
- **Gereksiz Render Önleme:**
  - Açılır menü (dropdown) veya sekme geçişlerinde ağır öğrenci listesi yeniden hesaplanmayacak.

---

## Do Not Disturb / Saklanan Özellikler
- Öğrencilerin tüm rozetleri tabloda açık ve görsel zenginliği korunarak görünmeye devam edecek.
- Öğrenci detay modalı ve takım kadro modalı tüm geçmiş ve rozet detaylarını eksiksiz sunmaya devam edecek.

---

## Doğrulama Planı
1. `compile_applet` ile projenin derleme durumunu doğrulama.
2. `lint_applet` ile TypeScript ve kod standartlarını denetleme.
3. Arayüz geçiş hızı ve donmasız 60fps akıcılığı kontrol etme.
