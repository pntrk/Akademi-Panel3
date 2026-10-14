# OptikAI OMR Okuma Motoru Hassasiyet ve Dinamik Eşik İyileştirme Planı

Yüklenen öğrenci sınav sonuç karneleri ve optik form taramalarında (ör. Güney Şimşir, Oğulcan Ördekçi, Ezgi Baştürk) yapılan incelemede; **tüm cevapları A olarak işaretlenmiş** olmasına rağmen bazı soruların (ör. Matematik 18, Fen 3, Türkçe 3, 10, 19 vb.) sistem tarafından **BOŞ (-)** olarak algılandığı tespit edilmiştir.

Bu durumun temel nedeni, önceki OMR motorundaki mutlak **`maxD >= 40.0`** eşiğinin, hafif/orta kurşun kalem basımı veya tarayıcı/kamera aydınlatması altındaki bazı işaretlemelerde (ör. koyuluğu 28–38 arasında kalan işaretlemeler) sorunun boş kabul edilmesine yol açmasıdır.

Bu plan, **kurum içi deneme sınavlarında hiçbir işaretli sorunun boş algılanmamasını** sağlayacak dinamik bağıl kontrast ve adaptif tolerans geliştirmelerini içermektedir.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Yapılacak Kritik İyileştirme Kararları**:
> 1. **Mutlak Eşik Esnekliği**: Katı `maxD >= 40.0` şartı yerine grafit taban alt eşiği **`26.0`** seviyesine çekilecek.
> 2. **Dinamik Soru Tabanı (Bağıl Kontrast)**: Soru bazındaki diğer boş seçeneklerin koyuluk ortalaması (`minScore`) hesaplanarak, seçeneğin kağıt yüzeyine göre net koyuluk farkı (`best.score - minScore >= 12.0`) esas alınacak.
> 3. **Adaptif Mikro Arama**: Baloncuk çekirdek merkezleme yarıçapı +-2 pikselden +-5 piksele çıkarılarak, tarama eğikliklerindeki mikro kaymalar tolere edilecek.

---

## 1. Algoritma ve Karar Motoru İyileştirmeleri

### A. Mikro Arama Yarıçapı ve Hizalama Toleransı
- Mevcut `searchLimit = 2` piksel sınırı, dinamik olarak `Math.max(4, Math.round(bubbleRadiusPx * 0.5))` piksere genişletilecek (yaklaşık +-5 piksel).
- Homografi veya ölçekleme kaynaklı ufak kaymalarda dahi doldurulmuş baloncuğun en koyu grafit çekirdeği tam merkezden yakalanacak.

### B. Dinamik Bağıl Kontrast Formülü (`evaluateQuestionAnswerOptikAI`)
Soru içerisindeki $N$ adet seçeneğin ($A, B, C, D, E$) koyuluk puanları sıralanacaktır:
- **Kağıt Tabanı ($minScore$)**: Soru içerisindeki en düşük koyuluğa sahip seçeneğin puanı (boş kağıt/baloncuk çerçeve gürültüsü).
- **Net Koyuluk Farkı ($netDarkness$)**: $best.score - minScore$.
- **Cevap Karar Kuralı**:
  - Eğer $best.score \ge 26.0$ VE ($netDarkness \ge 12.0$ veya $diff \ge 10.0$) ise: **Şık İşaretli Kabul Edilir**.
  - Eğer $best.score < 26.0$ veya $netDarkness < 10.0$ ise: **Soru Boş ($""$) Kabul Edilir**.
  - Çift İşaretleme Kontrolü: İkinci en koyu şık da $score \ge 35.0$ ve $diff < 10.0$ ise **Çift İşaretli (Geçersiz)** kabul edilir.

---

## 2. Teknik Mimari ve Akış Şeması

```
┌─────────────────────────────────────────────────────────┐
│                      ScanView.tsx                       │
│  (Sınav tipi: isInternalExam => OptikAI Hassas Motoru) │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                   calculateTrueRowY                     │
│  (dikey +-15px tarama ile satır kilitlenme offseti)     │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│              evaluateQuestionAnswerOptikAI             │
│  1. Mikro Yarıçap Araması (±4..6px genişletilmiş)      │
│  2. Soru Bazlı Kağıt Tabanı (minScore) Hesaplama        │
│  3. Bağıl Kontrast (best.score - minScore >= 12)        │
│  4. Esnek Grafit Taban Eşiği (best.score >= 26)         │
│  5. Çift İşaretleme / Silgi Ayrımı (diff >= 10)         │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│              Soru Cevabı & Güven Skoru                 │
│  (Boş Yanlışlıkları Sıfırlanmış Kusursuz Optik Sonuç)  │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Uygulama Adımları

1. **`src/lib/omrEngine.ts` Güncellemesi**:
   - `evaluateQuestionAnswerOptikAI` fonksiyonunda `searchLimit` değerini genişletme.
   - `minScore` ve `netDarkness` dinamik bağıl kontrast mantığını ekleme.
   - Taban eşiği 40.0'tan 26.0'ya çekilerek hafif kurşun kalem izlerinin doğru okunmasını sağlama.

2. **`src/views/ScanView.tsx` Güncellemesi**:
   - Hem tek sayfa doğrudan taramada (`processSinglePageDirect`) hem de toplu taramada (`readForm`) dinamik eşikli OptikAI motorunu devreye alma.
   - Sonuç karne görünümünde güven skoru ve okunan cevapların doğruluğunu teyit etme.

3. **Derleme ve Doğrulama (`compile_applet` & `lint_applet`)**:
   - Kod değişikliklerinin sorunsuz derlendiğini doğrulamak.
