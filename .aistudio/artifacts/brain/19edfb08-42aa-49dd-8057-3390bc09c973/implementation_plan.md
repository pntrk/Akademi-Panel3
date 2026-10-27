# Akademi Arena Yönlendirme Koçu & Gelişim Reçetesi

Akademi Arena ligindeki her öğrenci için son girdiği deneme sınavı verilerini ve aylık rozet birikimini pedagojik kurallarla analiz eden, güçlü yönleri, riskli dersleri ve bir sonraki sınav için 3 maddelik somut eylem planını sunan interaktif rehberlik koçu ve yazdırılabilir rehberlik kartı sistemi.

## User Review & Critical Decisions

> [!IMPORTANT]
> Kullanıcı tercihleri doğrultusunda sistem tamamen kural tabanlı pedagojik LGS analiz motoruyla çalışacak, sonuçlar detaylı bir modal pencerede açılacak ve hem ekranda görüntülenebilecek hem de tek tıklamayla yazdırılabilir rehberlik kartı olarak çıktı alınabilecektir.

- **Onaylanan Görünüm Modeli**: Lig tablosunda, mobil kartlarda ve öğrenci detay modalında erişilebilen "🎯 Yönlendirme Koçu" butonu; açılan kapsamlı modal ve yazdırılabilir rehberlik kartı.
- **Onaylanan Analiz Mantığı**: Deterministik, hızlı ve güvenilir kural tabanlı pedagojik analiz motoru (son deneme netleri, ders bazlı doğruluk oranları, boş/yanlış disiplini ve kazanılan/kaçırılan rozetlerin çapraz sentezi).
- **Onaylanan İçerik Kapsamı**: 
  1. Genel Performans & Rozet Nabzı (Son sınav puanı, lig sırası, aylık rozetler).
  2. Güçlü Yönler (Hangi ders ve alanlarda üstün başarı gösteriyor).
  3. Riskli Alanlar & Dikkat Noktaları (Net kaybettiren dersler, sallama/boş bırakma alışkanlıkları).
  4. Bir Sonraki Sınav İçin 3 Maddelik Somut Taktik Reçetesi (Doğrudan net artırmaya yönelik uygulanabilir adımlar).

---

## 1. Overview & Core Concept

- **Ne İşe Yarar**: Akademi Arena'da öğrencilerin yalnızca puan ve sıralamasını görmek yerine, sınav performansını ve rozet kazanımlarını pedagojik bir koç perspektifiyle yorumlayarak öğrenciye ve öğretmene bir sonraki deneme için nokta atışı aksiyon planı sunar.
- **Hedef Kitle**: Öğretmenler, mentorlar, öğrenciler ve veliler.
- **Sağlanan Temel Fayda**: Ham veriyi (doğru, yanlış, net, rozet) anlamlı bir koçluk tavsiyesine dönüştürür; öğrencinin denemeden denemeye bilinçli hazırlanmasını sağlar.

---

## 2. User Experience & Visual Design

### A. Temel Kullanıcı Akışı
1. **Butona Tıklama**: Kullanıcı, Akademi Arena lig tablosunda öğrencinin satırındaki "🎯 Koç Yorumu" butonuna, mobil karttaki koç rozetine veya öğrenci detay modalındaki "Yönlendirme Koçu" butonuna tıklar.
2. **Koçluk Analizi Ekranı**:
   - **Başlık & Kimlik**: Öğrenci adı, sınıfı, takımı (⭐ Kutup, 🚀 Sıçrama, 🛡️ Taktik), Arena lig sırası ve son sınav tarihi.
   - **Son Sınav & Rozet Özeti**: Son sınav LGS puanı, genel net, son sınavda kazanılan rozetler ve bu ay toplanan rozet çeşitleri.
   - **3 Ana Analiz Kartı**:
     - 🌟 **Güçlü Yönler**: Örneğin "Sözel branşlarda 0 yanlış ile yüksek konsantrasyon", "Matematikte net artışı".
     - ⚠️ **Gelişime Açık & Riskli Alanlar**: Örneğin "Fen bilimlerinde 5 yanlış - konu eksiği veya soru kökü dikkatsizliği", "Kalkan rozeti eksik: Emin olunmayan soruları boş bırakmak yerine işaretleme eğilimi".
     - 🚀 **Bir Sonraki Sınav İçin 3 Maddelik Taktik Reçetesi**:
       - *1. Taktik (Süre & Strateji)*: Hangi testten başlanmalı, takılınca turlama nasıl yapılmalı.
       - *2. Taktik (Öncelikli Ders)*: En çok net kazandıracak 1 odak ders ve hedef net.
       - *3. Taktik (Rozet Hedefi)*: Bir sonraki sınavda hedeflenen rozet (örn. "Kalkan" veya "Denge Cambazı").
3. **Yazdırma / Paylaşma**: Modal üzerindeki "🖨️ Rehberlik Kartını Yazdır" butonu ile A4 formatında temiz, rozet ve tavsiyeleri içeren şık bir veli/öğrenci rehberlik çıktısı alınır.

### B. Görsel Kimlik ve Tipografi
- **Renk Paleti**:
  - Kutup Yıldızları: Amber & Altın vurgular (`#B08D57`, `#F59E0B`)
  - Sıçrama Ustaları: Safir Mavi (`#2563EB`)
  - Taktik Avcıları: Zümrüt Yeşili (`#059669`)
  - Arka Plan: Yumuşak krem/beyaz kart yapısı (`#FAF9F6`, `bg-white`) ile temiz kenarlıklar (`border-brand-border/80`).
- **Tipografi**:
  - Başlıklar: Serif zarafeti (`font-serif`, Cormorant / Playfair)
  - Metinler: Net okunabilir `Plus Jakarta Sans / Inter`
  - Sayılar ve Puanlar: `tabular-nums font-mono`

---

## 3. Key Product Decisions & Trade-Offs

- **Karar 1: Kural Tabanlı Pedagojik Motor (Rule-based Engine)**
  - *Seçilen Yaklaşım*: LGS dinamiklerine göre optimize edilmiş 20+ kurallı deterministik koçluk algoritması.
  - *Neden*: Sıfır ağ gecikmesi, internet gerektirmemesi, her zaman tutarlı ve pedagojik olarak doğru LGS rehberlik ilkelerine (3 yanlış 1 doğru kuralı, turlama tekniği, boş bırakma disiplini) bağlı kalması.
- **Karar 2: Yazdırılabilir A4 Rehberlik Kartı (`@media print`)**
  - *Seçilen Yaklaşım*: Modal içindeki içerik, yazdırıldığında otomatik olarak A4 sayfasına uygun, temiz ve okul logolu bir rehberlik karnesi formatına bürünür.
  - *Neden*: Öğretmenlerin veli toplantılarında veya birebir koçluk görüşmelerinde öğrenciye somut bir rehberlik kağıdı teslim edebilmesi.
- **Karar 3: Rozet ve Net Çaprazlama Analizi**
  - *Seçilen Yaklaşım*: Yalnızca ham netlere değil, "Kalkan", "Tam İsabet", "Kırmızı Kart", "Denge Cambazı", "Zirve Koruma" gibi rozetlerin son denemedeki ve ay genelindeki durumuna göre yorum yapılması.

---

## 4. Technical Architecture & Data Strategy

### A. Sistem Mimarisi & Veri Akışı

```
┌──────────────────────────────────────────────────────────────┐
│                    Akademi Arena (LeagueView)                │
│  - Lig Tablosu (Desktop)                                     │
│  - Mobil Öğrenci Kartları                                    │
│  - Öğrenci Detay Modalı (Modal Roster)                       │
└──────────────────────────────┬───────────────────────────────┘
                               │ Tıklama: handleOpenCoachingModal(student)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│       Öğrenci Verisi + Son Sınav + Aylık Rozetler             │
│  - s.examHistory (Son sınav sonuçları, ders D/Y/B/N)          │
│  - s.badgeHistory & s.displayBadges (Aylık ve son rozetler)  │
│  - s.leagueTeam & s.displayPoints                            │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│         coachEngine.ts (Pedagojik Yönlendirme Motoru)        │
│  1. Sınav net/puan analizi (Türkçe, Mat, Fen, Sözel dersler) │
│  2. Boş/Yanlış disiplini (Kalkan & Kırmızı Kart kontrolü)    │
│  3. Rozet kazanımları & eksik rozet analizi                  │
│  4. Güçlü Yönler (Strengths) üretimi                         │
│  5. Riskli Alanlar (Weaknesses) üretimi                       │
│  6. 3 Maddelik Somut Taktik Reçetesi (Actionable Next Steps) │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│         StudentCoachingModal.tsx (Görsel & Yazdırılabilir)   │
│  - Şık UI: Güçlü yönler, riskli dersler, taktik kartları     │
│  - Buton: 🖨️ Yazdır / PDF Çıktısı (A4 print optimize)       │
└──────────────────────────────────────────────────────────────┘
```

### B. Yeni ve Güncellenecek Modüller
1. **`src/lib/coachEngine.ts` (Yeni Dosya)**:
   - Öğrencinin son sınavını (`student.examHistory` veya `results`) tespit eden yardımcı.
   - Son sınavdaki ders bazlı başarı oranlarını (D, Y, B, Net) ve rozetleri değerlendiren kurallar.
   - Çıktı arayüzü:
     ```ts
     interface CoachingReport {
       studentName: string;
       className?: string;
       team: string;
       rank: number;
       examName: string;
       examDate?: string;
       lgsScore: number;
       totalNet: number;
       recentBadges: string[];
       monthlyBadgeCount: number;
       strengths: Array<{ title: string; desc: string; icon: string }>;
       risks: Array<{ title: string; desc: string; icon: string }>;
       tactics: Array<{ step: number; title: string; action: string; icon: string }>;
     }
     ```
2. **`src/components/coaching/StudentCoachingModal.tsx` (Yeni Bileşen)**:
   - Öğrencinin rehberlik koçluk raporunu şık bir modalda sunar.
   - Yazdırma modu (`@media print` veya temiz print stili) ile veli bilgilendirme fişi formatını destekler.
3. **`src/views/LeagueView.tsx` (Entegrasyon)**:
   - Masaüstü lig tablosundaki her öğrenci satırına "🎯 Koç" aksiyon butonu.
   - Mobil öğrenci kartlarına "🎯 Koç Yorumu" butonu.
   - Öğrenci detay modalının üst kısmına "🎯 Yönlendirme Koçu Analizini Gör" butonu.

---

## 5. Pre-Flight Verification & Execution Checklist

- [ ] `coachEngine.ts` motoru hatasız TypeScript kurallarıyla yazılacak.
- [ ] 0 yanlış, 1 yanlış, çok yanlış ve boş bırakan tüm öğrenci profilleri için gerçekçi pedagojik tavsiyeler üretilecek.
- [ ] `StudentCoachingModal` hem ekranda kusursuz responsive olacak hem de yazdırıldığında A4 formatında derli toplu çıkacak.
- [ ] `LeagueView.tsx` içerisindeki mevcut tıklama ve lig hesaplama fonksiyonları bozulmadan entegre edilecek.
- [ ] `npm run lint` ve `npm run build` ile derleme doğrulanacak.
