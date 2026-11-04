/**
 * MEB 8. Sınıf LGS Resmi Müfredat Kazanım Kataloğu
 * 6 Temel Branş: Türkçe, Matematik, Fen Bilimleri, T.C. İnkılap Tarihi, Din Kültürü, İngilizce
 */

export interface CurriculumOutcomeDefinition {
  code: string;
  subject: string;
  unit: string;
  topic: string;
  description: string;
}

export const LGS_CURRICULUM_OUTCOMES: CurriculumOutcomeDefinition[] = [
  // ==================== TÜRKÇE ====================
  {
    code: '8.3.2.1',
    subject: 'Türkçe',
    unit: 'Söz Varlığı',
    topic: 'Sözcükte Anlam',
    description: 'Bağlamdan yararlanarak bilmediği kelime ve kelime gruplarının anlamını tahmin eder.'
  },
  {
    code: '8.3.2.2',
    subject: 'Türkçe',
    unit: 'Söz Varlığı',
    topic: 'Deyim ve Atasözü',
    description: 'Deyim, atasözü ve özdeyişlerin metne katkısını belirler.'
  },
  {
    code: '8.3.2.5',
    subject: 'Türkçe',
    unit: 'Dil Bilgisi',
    topic: 'Fiilimsiler',
    description: 'Fiilimsilerin cümledeki işlevlerini kavrar.'
  },
  {
    code: '8.3.3.3',
    subject: 'Türkçe',
    unit: 'Okuma / Anlama',
    topic: 'Metin Analizi',
    description: 'Metinle ilgili soruları cevaplar.'
  },
  {
    code: '8.3.3.6',
    subject: 'Türkçe',
    unit: 'Okuma / Anlama',
    topic: 'Ana Fikir / Ana Duygu',
    description: 'Metnin ana fikrini/ana duygusunu belirler.'
  },
  {
    code: '8.3.3.10',
    subject: 'Türkçe',
    unit: 'Okuma / Anlama',
    topic: 'Metin Yorumlama',
    description: 'Metnin içeriğini yorumlar.'
  },
  {
    code: '8.3.3.10.3',
    subject: 'Türkçe',
    unit: 'Okuma / Anlama',
    topic: 'Metinde Ayrıntı',
    description: 'Metindeki örnek ve ayrıntılara atıf yapılması sağlanır.'
  },
  {
    code: '8.3.3.14',
    subject: 'Türkçe',
    unit: 'Okuma / Anlama',
    topic: 'Çıkarımda Bulunma',
    description: 'Okudukları ile ilgili çıkarımlarda bulunur.'
  },
  {
    code: '8.3.3.16',
    subject: 'Türkçe',
    unit: 'Okuma / Anlama',
    topic: 'Görsel Okuma',
    description: 'Görsellerle ilgili soruları cevaplar.'
  },
  {
    code: '8.3.3.21',
    subject: 'Türkçe',
    unit: 'Okuma / Anlama',
    topic: 'Grafik ve Tablo Okuma',
    description: 'Grafik, tablo ve çizelgeyle sunulan bilgileri yorumlar.'
  },
  {
    code: '8.3.3.25',
    subject: 'Türkçe',
    unit: 'Okuma / Anlama',
    topic: 'Metin Karşılaştırma',
    description: 'Metinler arasında karşılaştırma yapar.'
  },
  {
    code: '8.3.4.1',
    subject: 'Türkçe',
    unit: 'Dil Bilgisi',
    topic: 'Cümlenin Ögeleri',
    description: 'Cümlenin ögelerini ayırt eder.'
  },
  {
    code: '8.3.4.2',
    subject: 'Türkçe',
    unit: 'Dil Bilgisi',
    topic: 'Fiilde Çatı',
    description: 'Fiillerin çatı özelliklerinin anlama olan katkısını değerlendirir.'
  },
  {
    code: '8.3.4.3',
    subject: 'Türkçe',
    unit: 'Dil Bilgisi',
    topic: 'Cümle Türleri',
    description: 'Cümle türlerini tanır ve işlevlerini kavrar.'
  },
  {
    code: '8.4.1.16',
    subject: 'Türkçe',
    unit: 'Yazma / İmla',
    topic: 'Yazım ve Noktalama',
    description: 'Yazdıklarını düzenler (Yazım ve noktalama kurallarını uygular).'
  },

  // ==================== T.C. İNKILAP TARİHİ VE ATATÜRKÇÜLÜK ====================
  {
    code: '8.1.1.1',
    subject: 'T.C. İnkılap Tarihi',
    unit: 'Bir Kahraman Doğuyor',
    topic: '20. Yüzyıl Başlarında Osmanlı',
    description: "Avrupa'daki gelişmelerin yansımaları bağlamında Osmanlı Devleti'nin yirminci yüzyılın başlarındaki siyasi ve sosyal durumunu kavrar."
  },
  {
    code: '8.1.1.2',
    subject: 'T.C. İnkılap Tarihi',
    unit: 'Bir Kahraman Doğuyor',
    topic: 'Mustafa Kemal Çocukluk ve Öğrenim',
    description: "Mustafa Kemal'in çocukluk ve öğrenim hayatından hareketle onun kişilik özelliklerinin oluşumu hakkında çıkarımlarda bulunur."
  },
  {
    code: '8.1.1.3',
    subject: 'T.C. İnkılap Tarihi',
    unit: 'Bir Kahraman Doğuyor',
    topic: 'Fikir Hayatını Etkileyen Olaylar',
    description: "Gençlik döneminde Mustafa Kemal'in fikir hayatını etkileyen önemli kişileri ve olayları kavrar."
  },
  {
    code: '8.1.1.4',
    subject: 'T.C. İnkılap Tarihi',
    unit: 'Bir Kahraman Doğuyor',
    topic: 'Askerlik Hayatı ve Kişilik Özellikleri',
    description: "Mustafa Kemal'in askerlik hayatı ile ilgili olayları ve olguları onun kişilik özellikleri ile ilişkilendirir."
  },
  {
    code: '8.2.1.1',
    subject: 'T.C. İnkılap Tarihi',
    unit: 'Milli Uyanış',
    topic: '1. Dünya Savaşı',
    description: "Birinci Dünya Savaşı'nın sebeplerini ve savaşın başlamasına yol açan gelişmeleri kavrar."
  },
  {
    code: '8.2.1.2',
    subject: 'T.C. İnkılap Tarihi',
    unit: 'Milli Uyanış',
    topic: 'Osmanlı Cepheleri',
    description: "Birinci Dünya Savaşı'nda Osmanlı Devleti'nin durumu, savaştığı cepheler ve savaşın sonuçlarını değerlendirir."
  },
  {
    code: '8.2.1.3',
    subject: 'T.C. İnkılap Tarihi',
    unit: 'Milli Uyanış',
    topic: 'Mondros ve İşgaller',
    description: "Mondros Ateşkes Anlaşması'nın imzalanması ve uygulanması karşısında Osmanlı yönetiminin, Mustafa Kemal'in ve halkın tutumunu analiz eder."
  },
  {
    code: '8.2.1.4',
    subject: 'T.C. İnkılap Tarihi',
    unit: 'Milli Uyanış',
    topic: 'Kuvâ-yı Millîye ve Cemiyetler',
    description: "Kuvâ-yı Millîye'nin oluşum sürecini ve sonrasında meydana gelen gelişmeleri kavrar."
  },
  {
    code: '8.2.1.5',
    subject: 'T.C. İnkılap Tarihi',
    unit: 'Milli Uyanış',
    topic: 'Genelgeler ve Kongreler',
    description: "Millî Mücadele'nin hazırlık döneminde Mustafa Kemal'in yaptığı çalışmaları analiz eder."
  },
  {
    code: '8.2.1.6',
    subject: 'T.C. İnkılap Tarihi',
    unit: 'Milli Uyanış',
    topic: 'Misak-ı Millî ve BMM',
    description: "Misak-ı Millî'nin kabulünü ve Büyük Millet Meclisinin açılışını vatanın bütünlüğü ve milletin bağımsızlığı açısından değerlendirir."
  },
  {
    code: '8.3.1.1',
    subject: 'T.C. İnkılap Tarihi',
    unit: 'Milli Bir Destan: Ya İstiklal Ya Ölüm',
    topic: 'Doğu ve Güney Cepheleri',
    description: "Millî Mücadele Dönemi'nde Doğu Cephesi ve Güney Cephesi'nde meydana gelen gelişmeleri kavrar."
  },
  {
    code: '8.3.1.2',
    subject: 'T.C. İnkılap Tarihi',
    unit: 'Milli Bir Destan: Ya İstiklal Ya Ölüm',
    topic: 'Batı Cephesi ve Savaşlar',
    description: "Millî Mücadele Dönemi'nde Batı Cephesi'nde meydana gelen gelişmeleri analiz eder."
  },

  // ==================== DİN KÜLTÜRÜ VE AHLAK BİLGİSİ ====================
  {
    code: '8.1.1.1',
    subject: 'Din Kültürü',
    unit: 'Kader İnancı',
    topic: 'Kader ve Kaza',
    description: 'Kader ve kaza inancını ayet ve hadislerle açıklar.'
  },
  {
    code: '8.1.1.2',
    subject: 'Din Kültürü',
    unit: 'Kader İnancı',
    topic: 'İnsan İradesi ve Sorumluluk',
    description: 'İnsanın ilmi, iradesi, sorumluluğu ile kader arasında ilişki kurar.'
  },
  {
    code: '8.1.1.3',
    subject: 'Din Kültürü',
    unit: 'Kader İnancı',
    topic: 'Kaza ve Kader ile İlgili Kavramlar',
    description: 'Kaderle ilgili kavramları analiz eder (Ömür, ecel, rızık, tevekkül, başarı, sağlık vb.).'
  },
  {
    code: '8.1.1.4',
    subject: 'Din Kültürü',
    unit: 'Kader İnancı',
    topic: 'Hz. Musa (a.s.)',
    description: "Hz. Musa'nın (a.s.) hayatını ana hatlarıyla tanır."
  },
  {
    code: '8.1.1.5',
    subject: 'Din Kültürü',
    unit: 'Kader İnancı',
    topic: 'Ayet el-Kürsi',
    description: 'Ayet el-Kürsi’yi okur, anlamını ana hatlarıyla açıklar.'
  },
  {
    code: '8.2.1.1',
    subject: 'Din Kültürü',
    unit: 'Zekât ve Sadaka',
    topic: 'İslam’ın Paylaşma ve Yardımlaşmaya Verdiği Önem',
    description: 'İslam’ın paylaşma ve yardımlaşmaya verdiği önemi ayet ve hadisler ışığında açıklar.'
  },
  {
    code: '8.2.1.2',
    subject: 'Din Kültürü',
    unit: 'Zekât ve Sadaka',
    topic: 'Zekât ve Sadaka İbadeti',
    description: 'Zekât ve sadaka ibadetini ayet ve hadislerle açıklar.'
  },
  {
    code: '8.3.1.1',
    subject: 'Din Kültürü',
    unit: 'Din ve Hayat',
    topic: 'Dinin Temel Gayesi',
    description: 'Dinin temel gayesinin can, nesil, akıl, mal ve din emniyetini sağlamak olduğunu açıklar.'
  },

  // ==================== İNGİLİZCE ====================
  {
    code: '8.1.4.2',
    subject: 'İngilizce',
    unit: 'Friendship',
    topic: 'Reading Invitations',
    description: 'Students will be able to understand short and simple invitation letters, cards and e-mails.'
  },
  {
    code: '8.1.10',
    subject: 'İngilizce',
    unit: 'Friendship',
    topic: 'Friendship Vocabulary',
    description: 'Words about friendship and personality traits of good friends.'
  },
  {
    code: '8.1.11',
    subject: 'İngilizce',
    unit: 'Friendship',
    topic: 'Accepting & Refusing',
    description: 'Accepting and refusing an invitation, giving explanations and reasons.'
  },
  {
    code: '8.1.13',
    subject: 'İngilizce',
    unit: 'Friendship',
    topic: 'Excuses & Apologies',
    description: 'Making an excuse and apologizing.'
  },
  {
    code: '8.1.15',
    subject: 'İngilizce',
    unit: 'Friendship',
    topic: 'Invitation Details',
    description: 'Identifying key details in invitation cards and letters.'
  },
  {
    code: '8.1.16',
    subject: 'İngilizce',
    unit: 'Friendship',
    topic: 'True Friend Qualities',
    description: 'Identifying qualities of a true friend.'
  },
  {
    code: '8.1.18',
    subject: 'İngilizce',
    unit: 'Friendship',
    topic: 'Simple Inquiries',
    description: 'Making simple inquiries about daily routines and activities.'
  },
  {
    code: '8.2.1.1',
    subject: 'İngilizce',
    unit: 'Teen Life',
    topic: 'Daily Routines',
    description: 'Expressing likes, dislikes, preferences and daily routines of teenagers.'
  },
  {
    code: '8.3.1.1',
    subject: 'İngilizce',
    unit: 'In the Kitchen',
    topic: 'Cooking Process',
    description: 'Describing simple processes and expressing steps in a recipe.'
  },

  // ==================== MATEMATİK ====================
  {
    code: '8.1.1.1',
    subject: 'Matematik',
    unit: 'Sayılar ve İşlemler',
    topic: 'Çarpanlar ve Katlar',
    description: 'Verilen pozitif tam sayıların pozitif tam sayı çarpanlarını bulur, pozitif tam sayıların pozitif tam sayı çarpanlarını üslü ifadelerin çarpımı şeklinde yazar.'
  },
  {
    code: '8.1.1.2',
    subject: 'Matematik',
    unit: 'Sayılar ve İşlemler',
    topic: 'EBOB - EKOK',
    description: 'İki doğal sayının en büyük ortak bölenini (EBOB) ve en küçük ortak katını (EKOK) hesaplar, ilgili problemleri çözer.'
  },
  {
    code: '8.1.1.3',
    subject: 'Matematik',
    unit: 'Sayılar ve İşlemler',
    topic: 'Aralarında Asal Sayılar',
    description: 'Verilen iki doğal sayının aralarında asal olup olmadığını belirler.'
  },
  {
    code: '8.1.2.1',
    subject: 'Matematik',
    unit: 'Sayılar ve İşlemler',
    topic: 'Üslü İfadeler',
    description: 'Tam sayıların, tam sayı kuvvetlerini hesaplar.'
  },
  {
    code: '8.1.2.2',
    subject: 'Matematik',
    unit: 'Sayılar ve İşlemler',
    topic: 'Üslü İfade Kuralları',
    description: 'Üslü ifadelerle ilgili temel kuralları anlar, birbirine denk ifadeler oluşturur.'
  },
  {
    code: '8.1.2.3',
    subject: 'Matematik',
    unit: 'Sayılar ve İşlemler',
    topic: 'Bilimsel Gösterim',
    description: 'Çok büyük ve çok küçük sayıları bilimsel gösterimle ifade eder ve karşılaştırır.'
  },
  {
    code: '8.1.3.1',
    subject: 'Matematik',
    unit: 'Sayılar ve İşlemler',
    topic: 'Kareköklü İfadeler',
    description: 'Tam kare pozitif tam sayılarla bu sayıların karekökleri arasındaki ilişkiyi belirler.'
  },
  {
    code: '8.1.3.2',
    subject: 'Matematik',
    unit: 'Sayılar ve İşlemler',
    topic: 'Karekök Tahmini',
    description: 'Tam kare olmayan kareköklü bir sayının hangi iki doğal sayı arasında olduğunu belirler.'
  },
  {
    code: '8.1.3.3',
    subject: 'Matematik',
    unit: 'Sayılar ve İşlemler',
    topic: 'a√b Gösterimi',
    description: 'Kareköklü bir ifadeyi a√b şeklinde yazar ve a√b şeklindeki ifadede katsayıyı kök içine alır.'
  },
  {
    code: '8.1.3.4',
    subject: 'Matematik',
    unit: 'Sayılar ve İşlemler',
    topic: 'Kareköklü İşlemler',
    description: 'Kareköklü ifadelerde çarpma, bölme, toplama ve çıkarma işlemlerini yapar.'
  },
  {
    code: '8.4.1.1',
    subject: 'Matematik',
    unit: 'Veri Analizi',
    topic: 'Grafik Türleri',
    description: 'En fazla üç veri grubuna ait çizgi ve sütun grafiklerini yorumlar, daire grafiği oluşturur.'
  },
  {
    code: '8.5.1.1',
    subject: 'Matematik',
    unit: 'Olasılık',
    topic: 'Basit Olayların Olasılığı',
    description: 'Basit bir olayın olma olasılığını hesaplar.'
  },
  {
    code: '8.2.1.1',
    subject: 'Matematik',
    unit: 'Cebir',
    topic: 'Cebirsel İfadeler',
    description: 'Basit cebirsel ifadeleri anlar ve farklı biçimlerde yazar.'
  },
  {
    code: '8.2.1.2',
    subject: 'Matematik',
    unit: 'Cebir',
    topic: 'Özdeşlikler',
    description: 'Cebirsel ifadelerin çarpımını yapar ve özdeşlikleri modellerle açıklar.'
  },

  // ==================== FEN BİLİMLERİ ====================
  {
    code: '8.1.1.1.5',
    subject: 'Fen Bilimleri',
    unit: 'Mevsimler ve İklim',
    topic: 'Eksen Eğikliği',
    description: "Dünya'nın ekseninin eğikliğinin mevsimlerin oluşumuna etkisini açıklar."
  },
  {
    code: '8.1.1.1.6',
    subject: 'Fen Bilimleri',
    unit: 'Mevsimler ve İklim',
    topic: 'Güneş Etrafında Dolanma',
    description: "Dünya'nın Güneş etrafında dolanmasının mevsimlerin oluşumuna katkısını açıklar."
  },
  {
    code: '8.1.1.1.8',
    subject: 'Fen Bilimleri',
    unit: 'Mevsimler ve İklim',
    topic: 'Kuzey ve Güney Yarım Küre',
    description: 'Güney yarım küre ile kuzey yarım kürenin aynı anda farklı mevsimler yaşadığını açıklar.'
  },
  {
    code: '8.1.1.1.9',
    subject: 'Fen Bilimleri',
    unit: 'Mevsimler ve İklim',
    topic: 'Güneş Işınlarının Gelme Açısı',
    description: 'Güneş ışınlarının gelme açısı ile bölgelerdeki sıcaklık arasındaki ilişkiyi açıklar.'
  },
  {
    code: '8.1.1.1.11',
    subject: 'Fen Bilimleri',
    unit: 'Mevsimler ve İklim',
    topic: 'Mevsim Tarihleri ve Konumlar',
    description: "Dünya'nın Güneş çevresinde dolanımı sırasında bulunduğu konumlara göre güney yarım kürede ve kuzey yarım kürede yaşanan mevsimleri tahmin eder."
  },
  {
    code: '8.1.2.1.1',
    subject: 'Fen Bilimleri',
    unit: 'Mevsimler ve İklim',
    topic: 'Hava Olayları',
    description: 'Hava olayını açıklar.'
  },
  {
    code: '8.1.2.1.4',
    subject: 'Fen Bilimleri',
    unit: 'Mevsimler ve İklim',
    topic: 'Rüzgâr Oluşumu',
    description: 'Rüzgâr kavramını ve yüksek/alçak basınç alanları arasındaki ilişkiyi açıklar.'
  },
  {
    code: '8.1.2.1.19',
    subject: 'Fen Bilimleri',
    unit: 'Mevsimler ve İklim',
    topic: 'İklimi Etkileyen Faktörler',
    description: 'İklimi etkileyen faktörleri listeler.'
  },
  {
    code: '8.1.2.2.3',
    subject: 'Fen Bilimleri',
    unit: 'Mevsimler ve İklim',
    topic: 'Küresel İklim Değişikliği',
    description: 'Küresel iklim değişikliğinin neden ve sonuçlarını belirtir.'
  },
  {
    code: '8.1.2.2.4',
    subject: 'Fen Bilimleri',
    unit: 'Mevsimler ve İklim',
    topic: 'İklim ve Hava Olayı Farkı',
    description: 'İklim ve hava olayları arasındaki farkları açıklar.'
  },
  {
    code: '8.2.1.1',
    subject: 'Fen Bilimleri',
    unit: 'DNA ve Genetik Kod',
    topic: 'Kromozom, DNA, Gen, Nükleotid',
    description: 'Nükleotid, gen, DNA ve kromozom kavramlarını açıklayarak bu kavramlar arasında ilişki kurar.'
  },
  {
    code: '8.2.1.1.6',
    subject: 'Fen Bilimleri',
    unit: 'DNA ve Genetik Kod',
    topic: 'Nükleotid Kavramı',
    description: 'Nükleotid kavramını açıklar.'
  },
  {
    code: '8.2.1.1.7',
    subject: 'Fen Bilimleri',
    unit: 'DNA ve Genetik Kod',
    topic: 'Nükleotid Yapısı',
    description: 'Nükleotidlerin yapısını (şeker, fosfat, organik baz) açıklar.'
  },
  {
    code: '8.2.1.2.4',
    subject: 'Fen Bilimleri',
    unit: 'DNA ve Genetik Kod',
    topic: 'DNA Baz Eşleşmesi',
    description: 'DNA’yı oluşturan nükleotidlerin karşılıklı zincirlerde belli bir kurala göre dizildiklerini (A-T, G-C) ifade eder.'
  },
  {
    code: '8.2.1.3',
    subject: 'Fen Bilimleri',
    unit: 'DNA ve Genetik Kod',
    topic: 'DNA Eşlenmesi',
    description: 'DNA’nın kendini nasıl eşlediğini ifade eder.'
  },
  {
    code: '8.2.2.1',
    subject: 'Fen Bilimleri',
    unit: 'DNA ve Genetik Kod',
    topic: 'Kalıtım ve Çaprazlama',
    description: 'Kalıtım ile ilgili kavramları tanımlar ve tek karakter çaprazlamalarını yapar.'
  },
  {
    code: '8.2.3.1',
    subject: 'Fen Bilimleri',
    unit: 'DNA ve Genetik Kod',
    topic: 'Mutasyon ve Modifikasyon',
    description: 'Mutasyon ve modifikasyon arasındaki farklar ile ilgili çıkarımda bulunur.'
  },
  {
    code: '8.2.4.1',
    subject: 'Fen Bilimleri',
    unit: 'DNA ve Genetik Kod',
    topic: 'Adaptasyon',
    description: 'Canlıların yaşadıkları çevreye uyumlarını (adaptasyon) gözlemleyerek açıklar.'
  },
  {
    code: '8.2.5.1',
    subject: 'Fen Bilimleri',
    unit: 'DNA ve Genetik Kod',
    topic: 'Biyoteknoloji',
    description: 'Biyoteknolojik uygulamaların yarar ve zararlarını değerlendirir.'
  },
  {
    code: '8.3.1.1',
    subject: 'Fen Bilimleri',
    unit: 'Basınç',
    topic: 'Katı Basıncı',
    description: 'Katı basıncını etkileyen değişkenleri deneyerek keşfeder.'
  },
  {
    code: '8.3.1.2',
    subject: 'Fen Bilimleri',
    unit: 'Basınç',
    topic: 'Sıvı Basıncı',
    description: 'Sıvı basıncını etkileyen değişkenleri tahmin eder ve tahminlerini test eder.'
  },
  {
    code: '8.1.1.1',
    subject: 'Fen Bilimleri',
    unit: 'Mevsimler ve İklim',
    topic: 'Mevsimlerin Oluşumu',
    description: 'Mevsimlerin oluşumuna yönelik tahminlerde bulunur.'
  },
  {
    code: '8.1.2.2',
    subject: 'Fen Bilimleri',
    unit: 'Mevsimler ve İklim',
    topic: 'İklim Bilimi (Klimatoloji)',
    description: 'İklim biliminin (klimatoloji) bir bilim dalı olduğunu ve bu alanda çalışan uzmanlara iklim bilimci (klimatolog) adı verildiğini söyler.'
  },
  {
    code: '8.2.3.2',
    subject: 'Fen Bilimleri',
    unit: 'DNA ve Genetik Kod',
    topic: 'Mutasyon Örnekleri',
    description: 'Örneklerden yola çıkarak mutasyonu açıklar.'
  },
  {
    code: '8.4.1.2',
    subject: 'Fen Bilimleri',
    unit: 'Madde ve Endüstri',
    topic: 'Periyodik Sistem',
    description: 'Elementleri periyodik tablo üzerinde metal, yarımetal ve ametal olarak sınıflandırır.'
  },
  {
    code: '8.7.1.1',
    subject: 'Fen Bilimleri',
    unit: 'Elektrik Yükleri ve Elektrik Enerjisi',
    topic: 'Elektriklenme',
    description: 'Elektriklenmeyi, bazı doğa olayları ve teknolojideki uygulama örnekleri ile açıklar.'
  },

  // Ek Matematik Kazanımları
  {
    code: '8.1.3.5',
    subject: 'Matematik',
    unit: 'Kareköklü İfadeler',
    topic: 'Kareköklü Sayılarda Toplama ve Çıkarma',
    description: 'Kareköklü ifadelerde toplama ve çıkarma işlemlerini yapar.'
  },
  {
    code: '8.1.3.6',
    subject: 'Matematik',
    unit: 'Kareköklü İfadeler',
    topic: 'Gerçek Sayılar',
    description: 'Gerçek sayıları tanır, rasyonel ve irrasyonel sayılarla ilişkilendirir.'
  },
  {
    code: '8.1.3.7',
    subject: 'Matematik',
    unit: 'Kareköklü İfadeler',
    topic: 'Ondalık İfadelerin Karekökü',
    description: 'Ondalık ifadelerin kareköklerini belirler.'
  },
  {
    code: '8.1.2.4',
    subject: 'Matematik',
    unit: 'Üslü İfadeler',
    topic: 'Çözümleme',
    description: 'Sayıların ondalık gösterimlerini 10’un tam sayı kuvvetlerini kullanarak çözümler.'
  },
  {
    code: '8.1.2.5',
    subject: 'Matematik',
    unit: 'Üslü İfadeler',
    topic: '10’un Farklı Kuvvetleri',
    description: 'Verilen bir sayıyı 10’un farklı tam sayı kuvvetlerini kullanarak ifade eder.'
  },
  {
    code: '8.3.2.2',
    subject: 'Matematik',
    unit: 'Dönüşüm Geometrisi',
    topic: 'Yansıma',
    description: 'Nokta, doğru parçası ve diğer şekillerin yansıma sonucu oluşan görüntüsünü oluşturur.'
  },

  // Ek Türkçe Kazanımları
  {
    code: '8.4.1.17',
    subject: 'Türkçe',
    unit: 'Yazma / Dil Bilgisi',
    topic: 'Noktalama İşaretleri',
    description: 'Noktalama işaretlerini işlevlerine uygun olarak kullanır.'
  },
  {
    code: '8.3.2.3',
    subject: 'Türkçe',
    unit: 'Söz Varlığı',
    topic: 'Söz Öbeklerinde Anlam',
    description: 'Söz öbeklerinde anlamı kavrar ve bağlamla ilişkilendirir.'
  },
  {
    code: '8.3.3.4',
    subject: 'Türkçe',
    unit: 'Cümlede Anlam',
    topic: 'Cümle Anlamı ve Tamamlama',
    description: 'Cümleler arasındaki anlam ilişkilerini kavrar; cümle tamamlama ve birleştirme yapar.'
  },
  {
    code: '8.3.3.5',
    subject: 'Türkçe',
    unit: 'Okuma / Anlama',
    topic: 'Metnin Konusu',
    description: 'Metnin konusunu belirler.'
  },
  {
    code: '8.3.3.7',
    subject: 'Türkçe',
    unit: 'Okuma / Anlama',
    topic: 'Yardımcı Fikirler',
    description: 'Metindeki yardımcı fikirleri belirler.'
  },
  {
    code: '8.3.3.11',
    subject: 'Türkçe',
    unit: 'Okuma / Anlama',
    topic: 'Dil ve Anlatım Biçimleri',
    description: 'Metindeki anlatım biçimlerini ve düşünceyi geliştirme yollarını belirler.'
  },
  {
    code: '8.3.3.12',
    subject: 'Türkçe',
    unit: 'Okuma / Anlama',
    topic: 'Paragrafta Yapı',
    description: 'Metnin giriş, gelişme ve sonuç bölümleri arasındaki yapısal bağı kurar.'
  },
  {
    code: '8.3.3.17',
    subject: 'Türkçe',
    unit: 'Şiir Bilgisi',
    topic: 'Şiirde Anlam ve Ahenk',
    description: 'Şiirdeki ana duyguyu, temayı ve söz sanatlarını belirler.'
  },
  {
    code: '8.3.3.24',
    subject: 'Türkçe',
    unit: 'Sözel Mantık',
    topic: 'Sözel Mantık ve Muhakeme',
    description: 'Tablo, grafik ve sözel yönergeleri analiz ederek mantıksal muhakemede bulunur.'
  },

  // Ek Din Kültürü Kazanımları (Bilfen / MEB Standartları)
  {
    code: '8.1.5',
    subject: 'Din Kültürü',
    unit: 'Kader İnancı',
    topic: 'Hz. Musa (a.s.)',
    description: 'Hz. Musa’nın (a.s.) hayatını ana hatlarıyla tanır.'
  },
  {
    code: '8.1.6',
    subject: 'Din Kültürü',
    unit: 'Kader İnancı',
    topic: 'Ayet el-Kürsi',
    description: 'Ayet el-Kürsi\'yi okur, anlamını söyler.'
  },
  {
    code: '8.1.2',
    subject: 'Din Kültürü',
    unit: 'Kader İnancı',
    topic: 'İnsan İradesi ve Kader',
    description: 'İnsanın ilmi, iradesi, sorumluluğu ile kader arasında ilişki kurar.'
  },
  {
    code: '8.1.3',
    subject: 'Din Kültürü',
    unit: 'Kader İnancı',
    topic: 'Kaza ve Kader Kavramları',
    description: 'Kaza ve kader ile ilgili kavramları analiz eder.'
  },
  {
    code: '8.1.4',
    subject: 'Din Kültürü',
    unit: 'Kader İnancı',
    topic: 'Toplumsal Yanlış Anlayışlar',
    description: 'Toplumda kader ve kaza ile ilgili yaygın olan yanlış anlayışları sorgular.'
  },
  {
    code: '8.2.2',
    subject: 'Din Kültürü',
    unit: 'Zekât ve Sadaka',
    topic: 'Zekât ve Sadaka İbadeti',
    description: 'Zekât ve sadaka ibadetini ayet ve hadislerle açıklar.'
  },

  // Ek İngilizce Kazanımları
  {
    code: 'E8.1.SP1',
    subject: 'İngilizce',
    unit: 'Friendship',
    topic: 'Simple Inquiries & Explanations',
    description: 'Students will be able to structure a talk to make simple inquiries, give explanations and reasons.'
  },
  {
    code: 'E8.1.L1',
    subject: 'İngilizce',
    unit: 'Friendship',
    topic: 'Understanding Invitations',
    description: 'Students will be able to understand the specific information in short conversations on everyday topics, such as accepting and refusing an offer/invitation.'
  },
  {
    code: 'E8.1.SI1',
    subject: 'İngilizce',
    unit: 'Friendship',
    topic: 'Spoken Interaction',
    description: 'Students will be able to interact with reasonable ease in structured situations involving accepting and refusing an offer.'
  },
  {
    code: 'E8.2.SP1',
    subject: 'İngilizce',
    unit: 'Teen Life',
    topic: 'Preferences & Teen Life',
    description: 'Students will be able to express what they prefer, like and dislike.'
  },
  {
    code: 'E8.2.R1',
    subject: 'İngilizce',
    unit: 'Teen Life',
    topic: 'Teen Activities',
    description: 'Students will be able to understand short and simple texts about regular activities of teenagers.'
  },
  {
    code: 'E8.2.SI1',
    subject: 'İngilizce',
    unit: 'Teen Life',
    topic: 'Daily Routines',
    description: 'Students will be able to talk about regular activities of teenagers.'
  },
  {
    code: 'E8.3.SP1',
    subject: 'İngilizce',
    unit: 'In The Kitchen',
    topic: 'Describing a Process',
    description: 'Students will be able to give a simple description about a process.'
  },
  {
    code: 'E8.3.R1',
    subject: 'İngilizce',
    unit: 'In The Kitchen',
    topic: 'Cooking Texts',
    description: 'Students will be able to understand the overall meaning of short texts about a process.'
  },
  {
    code: 'E8.3.R2',
    subject: 'İngilizce',
    unit: 'In The Kitchen',
    topic: 'Vocabulary in Context',
    description: 'Students will be able to guess the meaning of unknown words from the text.'
  },
  {
    code: '8.8.2.2',
    subject: 'İngilizce',
    unit: 'Chores',
    topic: 'Responsibilities',
    description: 'Students will be able to talk about responsibilities.'
  }
];

/**
 * Türkçe karakterleri düz ASCII karşılıklarına dönüştürür (güvenli karşılaştırma)
 */
export function normalizeTurkishText(str: string): string {
  return (str || '')
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Ders ismine göre kazanımları filtreler
 */
export function getOutcomesBySubject(subjectName: string): CurriculumOutcomeDefinition[] {
  const norm = normalizeTurkishText(subjectName || '').replace(/[\s\.\-_/()]+/g, '');
  if (norm.includes('din') || norm.includes('dkab') || norm.includes('ahlak')) {
    return LGS_CURRICULUM_OUTCOMES.filter(o => o.subject === 'Din Kültürü');
  }
  if (norm.includes('tar') || norm.includes('ink') || norm.includes('sos') || norm.includes('ataturk')) {
    return LGS_CURRICULUM_OUTCOMES.filter(o => o.subject === 'T.C. İnkılap Tarihi');
  }
  if (norm.includes('tur')) {
    return LGS_CURRICULUM_OUTCOMES.filter(o => o.subject === 'Türkçe');
  }
  if (norm.includes('mat')) {
    return LGS_CURRICULUM_OUTCOMES.filter(o => o.subject === 'Matematik');
  }
  if (norm.includes('fen')) {
    return LGS_CURRICULUM_OUTCOMES.filter(o => o.subject === 'Fen Bilimleri');
  }
  if (norm.includes('ing') || norm.includes('dil') || norm.includes('english')) {
    return LGS_CURRICULUM_OUTCOMES.filter(o => o.subject === 'İngilizce');
  }
  return LGS_CURRICULUM_OUTCOMES;
}

/**
 * Kazanım koduna göre detay bulur
 */
export function findOutcomeByCode(code: string): CurriculumOutcomeDefinition | undefined {
  if (!code) return undefined;
  const cleanCode = code.trim().toLowerCase();
  return LGS_CURRICULUM_OUTCOMES.find(o => o.code.toLowerCase() === cleanCode);
}

/**
 * Verilen metin veya konu başlığına göre müfredat kataloğunda en uygun kazanımı arar
 */
export function matchOutcomeByText(subject: string, text: string): CurriculumOutcomeDefinition | undefined {
  if (!text) return undefined;
  const outcomes = getOutcomesBySubject(subject);
  const cleanSearch = normalizeTurkishText(text).replace(/[\s\.\-_/()]+/g, ' ').trim();
  if (!cleanSearch) return undefined;

  // 1. Aşama: Konu veya açıklama içinde tam içerilme
  for (const item of outcomes) {
    const itemTopic = normalizeTurkishText(item.topic).replace(/[\s\.\-_/()]+/g, ' ').trim();
    const itemDesc = normalizeTurkishText(item.description).replace(/[\s\.\-_/()]+/g, ' ').trim();
    if (cleanSearch.includes(itemTopic) || itemDesc.includes(cleanSearch) || cleanSearch.includes(itemDesc)) {
      return item;
    }
  }

  // 2. Aşama: Kelime kümesi benzerliği (Jaccard / Token overlap)
  const searchTokens = new Set(cleanSearch.split(/\s+/).filter(t => t.length > 2));
  let bestMatch: CurriculumOutcomeDefinition | undefined = undefined;
  let highestScore = 0;

  for (const item of outcomes) {
    const itemTokens = normalizeTurkishText(`${item.topic} ${item.description}`)
      .split(/\s+/)
      .filter(t => t.length > 2);
    let common = 0;
    for (const t of itemTokens) {
      if (searchTokens.has(t)) common++;
    }
    const score = common / Math.max(searchTokens.size, 1);
    if (score > highestScore && score >= 0.4) {
      highestScore = score;
      bestMatch = item;
    }
  }

  return bestMatch;
}
