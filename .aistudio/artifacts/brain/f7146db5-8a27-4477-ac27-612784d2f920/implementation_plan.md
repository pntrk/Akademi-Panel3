# Akademi Arena Performans Optimizasyonu ve JSON Yedek Boyutunu Azaltma Planı

Kullanıcı geri bildirimlerine göre Akademi Arena arayüzündeki kasma/donma sorununu gidermek ve 7,3 MB'lık JSON yedek dosya boyutunu sıfır veri kaybıyla küçültmek için hazırlanan eylem planı.

---

## 1. Tespit Edilen Nedenler

### A. Akademi Arena (Lig & Rozetler) Donma Sebepleri
- **O(N³) Karmaşıklığında Hesaplamalar:** `LeagueView.tsx` bileşeninde `baseStudents` hesaplaması, yüzlerce öğrenci ve onlarca sınav için her render döngüsünde iç içe `.some()`, `.find()`, metin normalizasyonu ve `calculateAtaLigPoints` fonksiyonlarını çalıştırmaktadır.
- **DOM Şişmesi (DOM Bloat):** Tabloda tüm öğrencilerin (200-400+ öğrenci) tüm rozetleri aynı anda DOM'a basılmakta; ayrıca mobil kartlar da DOM'da gizli (`md:hidden`) olarak fazladan binlerce düğüm oluşturmaktadır.

### B. JSON Yedek Dosyasının 7,3 MB Olma Sebepleri
- **Biçimlendirme Fazlalığı:** `JSON.stringify(backupData, null, 2)` kullanımı, her bir ders neti ve soru için dosyaya milyonlarca boşluk (` `) ve satır başı (`\n`) karakteri ekleyerek dosya boyutunu 2-3 katına çıkarmaktadır.
- **Tekrarlayan Boş/Varsayılan Alanlar:** Sonuçlarda ve öğrencilerde sıfır değerli veya boş alanların temizlenmemesi.

---

## 2. Önerilen Değişiklikler

### A. Akademi Arena Arayüz Akıcılığı (`src/views/LeagueView.tsx`)
1. **Tek Geçişli İndeksleme (Pre-indexing):**
   - Sınav sonuçları ve öğrenci katılımları `state.exams` üzerinden tek bir geçişte `Map<studentKey, ExamResult[]>` haritasına indekslenecek.
   - `baseStudents` içindeki iç içe aramalar doğrudan `O(1)` hızında harita sorgularına dönüştürülecek.
2. **Kademeli Yükleme (Sayfalama / Load More):**
   - Tabloda ve mobil kart listesinde ilk etapta **30 öğrenci** listelenecek.
   - Listenin altına kullanıcı deneyimini bozmayan, şık bir **"Daha Fazla Göster (+30 Öğrenci)"** butonu eklenecek.
   - Filtreler (arama, sınıf, ay, takım) değiştiğinde sayaç otomatik olarak 30'a sıfırlanacak.
3. **Rozetlerin Korunması:**
   - Kullanıcının önceki tercihine uygun olarak kazanılan tüm rozetler tabloda açık ve tam olarak gösterilmeye devam edecek.

### B. JSON Yedek Boyutunun Küçültülmesi (`src/lib/backupOptimizer.ts` ve `src/components/Layout.tsx`)
1. **Standart Minify Edilmiş Çıktı:**
   - Yedek indirme işleminde `JSON.stringify(backupData, null, 2)` yerine standart sıkıştırılmış (boşluksuz) `JSON.stringify(backupData)` formatı kullanılacak. Bu tek başına 7,3 MB'lık dosyayı yaklaşık **2,8 - 3,2 MB** seviyesine (yarıdan daha aza) indirecektir.
2. **Sıfır Veri Kayıplı Alan Budama (Lossless Pruning):**
   - `createOptimizedBackupPayload` fonksiyonunda sıfır değerli/tanımsız alanlar temizlenecek, ancak öğrencinin netleri, puanları, optik cevapları ve rozetleri eksiksiz korunacak.
3. **Geri Yükleme Uyumluluğu:**
   - İçe aktarma (`handleRestore` ve `restoreBackup`) hem yeni minify edilmiş JSON hem de eski biçimlendirilmiş JSON dosyalarını sorunsuz okumaya devam edecek.

---

## 3. Doğrulama ve Test Adımları
1. **Derleme ve Tip Denetimi:** `compile_applet` ve `lint_applet` çalıştırılarak TypeScript hatasızlığı teyit edilecek.
2. **Performans Denetimi:** Akademi Arena sayfasına geçiş hızının ve filtreleme akıcılığının 60fps düzeyinde olduğu doğrulanacak.
3. **Yedek Doğrulama:** Üretilen minify JSON dosyasının veri kaybı olmadan oluşturulduğu ve başarıyla geri yüklenebildiği kontrol edilecek.
