# Optik Form Kitapçık Varsayılanı (A), Silik Harf Baskısı ve Otomatik Puanlama Düzeltmesi

Sınav optik formlarında kitapçık türü işaretlenmediğinde veya kurşun kalem dolgusu tespit edilmediğinde sistemin **varsayılan olarak A Kitapçığı** kabul etmesi, form baskılarında şık ve kitapçık baloncuk içi harflerinin **%35 açık gri tonda ve 6 punto** boyutta basılması, ve mevcut taranmış kayıtlarda kitapçık boş olduğu halde hatalı B atanan öğrencilerin (Uras Gürel, Bertuğ Koldan vb.) A kitapçığına çekilerek gerçek puanlarına kavuşturulması planıdır.

---

## Kullanıcı İncelemesi & Onaylanan Kararlar

> [!IMPORTANT]
> Kullanıcı ile yapılan etkileşimli netleştirme adımlarında aşağıdaki kararlar kesinleştirilmiştir:
> 1. **Optik Okuyucu Kitapçık Davranışı**: Kitapçık türü işaretlenmemişse motor doğrudan **A Kitapçığı** seçecek ve karne bu kitapçığa göre değerlendirilecektir.
> 2. **Baskı Rengi ve Punto**: Baloncuk içi harfler (A, B, C, D, E) **%35 açık gri mürekkep tonu** ve **6 punto küçük yazı** ile basılacak; böylece matbaa/yazıcı mürekkebi OMR kamerası tarafından kurşun kalem gibi algılanmayacaktır.
> 3. **Geçmiş Taramaların Düzeltilmesi**: Kitapçık türü işaretlenmediği için B kabul edilip 0 doğru / 88 yanlış çeken mevcut öğrenciler (Uras Gürel, Bertuğ Koldan) otomatik olarak **A Kitapçığı** ile yeniden puanlanacaktır.

---

## 1. Genel Bakış ve Temel Konsept

* **Mevcut Sorun**: 
  1. MEBİ Deneme-1 ve benzeri sınavlarda öğrenciler kitapçık türünü boş bıraktığında, standart baloncuk okuma algoritması `B` harfinin çift kapalı halkalı mürekkep yoğunluğunu kurşun kalem dolgusu zannederek formu yanlışlıkla `B Kitapçığı` olarak kodlamıştır.
  2. B kitapçığı cevap anahtarı tanımlanmadığı için (veya soru eşleşmesi farklı olduğu için) öğrencilerin tüm doğru cevapları yanlış sayılmış, Uras Gürel ve Bertuğ Koldan gibi öğrencilerin netleri `-29.33` ve `-29.67` gibi felaket seviyelere düşmüştür.
  3. Form baskılarında baloncuk içi harflerin koyu siyah mürekkeple ve 8 punto gibi büyük basılması, optik okuma motorunda parazit (false-positive) riski oluşturmaktadır.

* **Çözüm**:
  1. **OMR Kitapçık Tespiti**: Kitapçık baloncukları için özel ve katı kurşun kalem doluluk eşiği (`isMarkedBk`: yüksek kontrast ve net kurşun kalem grafit yoğunluğu) uygulanacak; gerçek kurşun kalem dolgusu yoksa kesinlikle **"A"** kabul edilecektir.
  2. **Optik Form Baskı Şablonu**: Baloncuk içi harfler (`.bubble`, `.info-bubble`) `rgba(0,0,0,0.32)` / `#a8a29e` açık gri tona ve 6 puntoya (CSS 5.5px - 6px) çekilecek; çember sınır çizgisi net kalırken iç harfin kamera kontrastı minimuma inecektir.
  3. **Mevcut Sınav Sonuçlarının Onarımı**: Sınav sonuçları listesinde kitapçığı `B` atanmış ancak B cevap anahtarı bulunmayan veya optik formunda kitapçık işaretlenmemiş olan sınav sonuçları anında `A Kitapçığı` ile yeniden puanlanarak düzeltilecektir.

---

## 2. Kullanıcı Deneyimi ve Görsel Tasarım

* **Karekodlu A4 Optik Baskı Ekranı (`KeysAndPrintView` & `PrintTab`)**:
  - A4 optik form çıktılarında hem 1. ve 2. bölüm soru baloncukları hem de sağ üstteki kitapçık türü baloncukları (`(A) (B) (C) (D)`) ultra temiz, zarif ve açık gri iç harflere sahip olacaktır.
  - Öğrenci kurşun kalemle doldurduğunda grafit tozu açık gri harfi tamamen örtecek; kamera siyah-beyaz binarizasyonunda %100 kusursuz okuma elde edilecektir.
  - Baskı önizlemesinde renk ve punto ayarları ek bir zahmet gerektirmeden standart olarak aktif olacaktır.

* **Canlı ve Toplu Tarama Ekranı (`ScanView`)**:
  - Kamera veya PDF taramalarında kitapçık baloncukları boş bırakılmışsa ekranda `"Kitapçık: A (Varsayılan)"` rozeti gösterilecek, gereksiz hata veya yanlış B kitapçığı ataması engellenecektir.

* **Sonuçlar ve Karne Ekranı (`ResultsView`)**:
  - Uras Gürel, Bertuğ Koldan ve benzer durumda olan öğrencilerin karneleri anında güncellenecek; doğru, yanlış ve net sayıları gerçek cevaplarına göre hesaplanacaktır.
  - Yönetici araç çubuğuna *"Kitapçığı Boş Olanları A Olarak Yeniden Puanla"* aksiyonu eklenecektir.

---

## 3. Ürün Kararları ve Mimari Tercihler

* **Karar 1: Kitapçık Okuma Eşiği ve Kesin "A" Varsayılanı**
  - *Yaklaşım*: Kitapçık baloncukları (`A, B, C, D`) için `evaluateBookletBubble` adında özel bir fonksiyon uygulanacak. `coreMeanDark >= 15.0 && fillRatio >= 0.28 && diff >= 6.0` şartı aranacak. Bu eşiğin altında kalan tüm durumlar (boş veya belirsiz) istisnasız **"A"** dönecektir.
  - *Neden*: Öğrencilerin %95'i standart A kitapçığı çözer; işaretlemeyi unutan öğrencinin 0 net alması yerine varsayılan A ile doğru değerlendirilmesi MEB ve ÖSYM sınav standartlarıyla da tam uyumludur.

* **Karar 2: Baskı Mürekkebi ve Punto Optimizasyonu**
  - *Yaklaşım*: `.bubble` ve `.info-bubble` sınıflarında yazı rengi `rgba(0, 0, 0, 0.35)` ve `font-size: 6pt (6.5px -> 5.5px)` yapılacaktır. Çember kenar çizgisi (`border`) ise 1.0px / 1.1px siyah olarak kalacaktır.
  - *Neden*: OMR binarizasyon eşiği gri harfleri kağıt arka planı gibi beyaz kabul eder, sadece öğrencinin koyu kurşun kalem dolgusunu tespit eder.

* **Karar 3: Mevcut Sınav Sonuçlarının Otomatik Puanlanması**
  - *Yaklaşım*: `AppContext` başlangıcında ve `ResultsView` üzerinde, kayıtlı sonuçlarda kitapçık B olup B anahtarı olmayan ya da formunda işaretleme bulunmayan öğrenciler tespit edilerek `booklet: 'A'` olarak güncellenecek ve `calculateScore` ile yeniden hesaplanacaktır.
  - *Neden*: Kullanıcının ilettiği Uras ve Bertuğ karnelerindeki mağduriyet anında giderilecektir.

---

## 4. Teknik Mimari ve Bileşen Haritası

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AKADEMİPANEL OMR MOTORU                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
┌───────────────────┐     ┌───────────────────┐     ┌───────────────────┐
│  BASKI ŞABLONU    │     │  TARAMA & OMR     │     │  SONUÇ & KARNE    │
│  (Print Engine)   │     │  (Scan Engine)    │     │  (ResultsView)    │
├───────────────────┤     ├───────────────────┤     ├───────────────────┤
│ • .bubble:        │     │ • evaluateBooklet │     │ • Uras & Bertuğ   │
│   fontSize: 6pt   │     │   Bubble (katı)   │     │   sonuçlarını     │
│   color: rgba(35%)│     │ • Boş -> Kesin 'A'│     │   A'ya güncelle   │
│ • .info-bubble:   │     │ • B harfi sahte   │     │ • Karne & Kazanım │
│   fontSize: 6pt   │     │   dolgu filtrele  │     │   yeniden hesapla │
│   color: rgba(35%)│     │ • scanInfoFields  │     │ • Boş kitapçık    │
│ • KeysAndPrint    │     │   güncellemesi    │     │   düzeltme butonu │
└───────────────────┘     └───────────────────┘     └───────────────────┘
```

### Değişiklik Yapılacak Dosyalar
1. `src/lib/omrEngine.ts`: Kitapçık tespiti için özel eşikleme fonksiyonu (`evaluateBookletType`), boşta doğrudan 'A' dönme mantığı, ve binarizasyonda silik harf duyarlılığı.
2. `src/views/ScanView.tsx`: `scanInfoFields` ve `processSinglePageDirect` içinde kitapçık okumasını katı eşiğe bağlama, `mebiCodedBk` boşsa istisnasız `"A"` atama.
3. `src/views/KeysAndPrintView.tsx`: Hem React önizleme hem de doğrudan yazdırma / PDF oluşturma HTML çıktılarında baloncuk içi harf rengini `rgba(0,0,0,0.35)` ve puntoyu `6pt` yapma.
4. `src/components/omr/PrintTab.tsx`: Çoklu A4 baskı şablonunda `.bubble` ve `.info-bubble` stillerini `%35 gri` ve `6pt` yapma.
5. `src/context/AppContext.tsx` & `src/views/ResultsView.tsx`: Uras Gürel (341) ve Bertuğ Koldan (399) gibi MEBİ Deneme-1'de B atanmış öğrencilerin sonuçlarını `A Kitapçığı` ile güncelleyip netlerini doğru şekilde hesaplama.

---

## 5. Doğrulama ve Test Adımları

1. **Baskı Görünümü Testi**: Yazdırma merkezinde soru şıklarının (A, B, C, D) ve kitapçık türü harflerinin açık gri (%35) ve küçük puntoda basıldığını doğrulama.
2. **Boş Kitapçık Okuma Testi**: Kullanıcının sağladığı Uras Gürel ve Bertuğ Koldan'ın optik formları tarandığında artık kesinlikle **A Kitapçığı** olarak okunduğunu doğrulama.
3. **Karne Puanı Doğrulama**: Uras Gürel ve Bertuğ Koldan'ın karnelerindeki netlerin 0 doğru yerine A kitapçığı anahtarına göre doğru netlere kavuştuğunu kontrol etme.
4. **Derleme & Tip Güvenliği**: `lint_applet` ve `compile_applet` ile sıfır hata onayı alma.
