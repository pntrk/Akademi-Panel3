import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  FileText, 
  Save, 
  RotateCcw, 
  Loader2, 
  Info,
  ChevronRight,
  HelpCircle,
  Download
} from 'lucide-react';
import { Exam, QuestionOutcomeItem } from '../../types';
import { parseCurriculumSpreadsheet } from '../../lib/curriculumParser';
import { LGS_CURRICULUM_OUTCOMES, getOutcomesBySubject } from '../../lib/curriculumData';

interface Props {
  exam: Exam;
  isOpen: boolean;
  onClose: () => void;
  onSaveOutcomes: (examId: string, outcomes: QuestionOutcomeItem[], keys?: { A: string[]; B?: string[] }) => Promise<void>;
}

export const ExamOutcomeModal: React.FC<Props> = ({
  exam,
  isOpen,
  onClose,
  onSaveOutcomes
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'upload' | 'ai' | 'preview'>('upload');
  const [outcomes, setOutcomes] = useState<QuestionOutcomeItem[]>(exam.outcomes || []);
  const [detectedKeys, setDetectedKeys] = useState<{ A: string[]; B?: string[] } | undefined>(
    exam.keys ? { A: exam.keys['A'] || [], B: exam.keys['B'] } : undefined
  );
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('Tümü');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // XML / Excel dosyası yükleme
  const handleSpreadsheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatusMsg(null);

    const reader = new FileReader();

    // XML / text tabanlı veya binary tabanlı okuma
    const isXml = file.name.endsWith('.xml') || file.type.includes('xml');

    if (isXml) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }

    reader.onload = (evt) => {
      try {
        const content = evt.target?.result;
        if (!content) throw new Error('Dosya içeriği okunamadı.');

        const result = parseCurriculumSpreadsheet(content);
        if (!result.success) {
          throw new Error(result.error || 'Dosya çözümlenemedi.');
        }

        setOutcomes(result.outcomes);
        setDetectedKeys(result.keys);
        setActiveTab('preview');
        setStatusMsg({
          type: 'success',
          text: `Harika! ${result.totalQuestions} adet soru, MEB kazanımları ve ${result.keys.B ? 'A ve B' : 'A'} cevap anahtarı başarıyla yüklendi.`
        });
      } catch (err: any) {
        setStatusMsg({
          type: 'error',
          text: err?.message || 'Tablo çözümlenirken hata oluştu. Lütfen geçerli bir yayıncı XML veya Excel tablosu yükleyin.'
        });
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setIsLoading(false);
      setStatusMsg({ type: 'error', text: 'Dosya okunurken bir tarayıcı hatası oluştu.' });
    };
  };

  // Taranmış PDF kitapçığı yükleyip Gemini AI ile eşleştirme
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setStatusMsg({ type: 'error', text: 'Lütfen taranmış bir deneme sınavı PDF dosyası seçin.' });
      return;
    }

    setIsLoading(true);
    setStatusMsg({ type: 'info', text: 'Yapay zeka (Gemini 3.8 Flash) deneme sınavı PDF içeriğini ve MEB kazanım ağacını analiz ediyor...' });

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];

          const response = await fetch('/api/gemini/match-outcomes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pdfBase64: base64Data,
              curriculumList: LGS_CURRICULUM_OUTCOMES.slice(0, 40)
            })
          });

          const data = await response.json();
          if (!data.success || !Array.isArray(data.outcomes)) {
            throw new Error(data.error || 'Yapay zeka soru eşleştirmesini tamamlayamadı.');
          }

          const matchedItems: QuestionOutcomeItem[] = data.outcomes.map((item: any) => ({
            qIndex: Number(item.qIndex),
            subject: item.subject || 'Genel',
            correctAnswer: item.correctAnswer || undefined,
            outcomeCode: item.outcomeCode || '8.Genel',
            outcomeDesc: item.outcomeDesc || 'MEB Müfredat Kazanımı',
            topic: item.subject
          }));

          setOutcomes(matchedItems);
          setActiveTab('preview');
          setStatusMsg({
            type: 'success',
            text: `Yapay zeka taranmış PDF'ten ${matchedItems.length} soruyu başarıyla MEB kazanımlarıyla eşleştirdi!`
          });
        } catch (postErr: any) {
          setStatusMsg({ type: 'error', text: postErr?.message || 'Yapay zeka sunucu yanıtında hata oluştu.' });
        } finally {
          setIsLoading(false);
          if (pdfInputRef.current) pdfInputRef.current.value = '';
        }
      };
    } catch (err: any) {
      setIsLoading(false);
      setStatusMsg({ type: 'error', text: 'PDF yükleme hatası: ' + err?.message });
    }
  };

  // Hazır yayıncı XML örneği yükleme
  const handleLoadSampleXml = async (samplePath: string, sampleTitle: string) => {
    setIsLoading(true);
    setStatusMsg({ type: 'info', text: `${sampleTitle} şablonu sunucudan okunuyor ve MEB kazanımlarıyla eşleştiriliyor...` });
    try {
      const response = await fetch(samplePath);
      if (!response.ok) throw new Error('Örnek dosya sunucudan alınamadı.');
      const text = await response.text();
      const result = parseCurriculumSpreadsheet(text);
      if (!result.success) throw new Error(result.error || 'Şablon çözümlenemedi.');

      setOutcomes(result.outcomes);
      setDetectedKeys(result.keys);
      setActiveTab('preview');
      setStatusMsg({
        type: 'success',
        text: `Harika! ${sampleTitle} (${result.totalQuestions} soru) başarıyla yüklendi. MEB kazanımları ve ${result.keys.B ? 'A ve B' : 'A'} cevap anahtarları eşleştirildi!`
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Örnek dosya yüklenirken hata oluştu.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Hazır örnek PDF ile Yapay Zeka analizi
  const handleLoadSamplePdf = async (sampleFileName: string, sampleLabel: string) => {
    setIsLoading(true);
    setStatusMsg({ type: 'info', text: `Yapay zeka (Gemini 3.8 Flash) ${sampleLabel} kitapçığını analiz ediyor...` });
    try {
      const response = await fetch('/api/gemini/match-outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sampleFileName,
          curriculumList: LGS_CURRICULUM_OUTCOMES.slice(0, 50)
        })
      });

      const data = await response.json();
      if (!data.success || !Array.isArray(data.outcomes)) {
        throw new Error(data.error || 'Yapay zeka soru eşleştirmesini tamamlayamadı.');
      }

      const matchedItems: QuestionOutcomeItem[] = data.outcomes.map((item: any) => ({
        qIndex: Number(item.qIndex),
        subject: item.subject || 'Genel',
        correctAnswer: item.correctAnswer || undefined,
        outcomeCode: item.outcomeCode || '8.Genel',
        outcomeDesc: item.outcomeDesc || 'MEB Müfredat Kazanımı',
        topic: item.subject
      }));

      setOutcomes(matchedItems);
      setActiveTab('preview');
      setStatusMsg({
        type: 'success',
        text: `Yapay zeka ${sampleLabel} içinden ${matchedItems.length} soruyu başarıyla MEB kazanımlarıyla eşleştirdi!`
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Yapay zeka analizinde hata oluştu.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Düzenleme / Güncelleme
  const handleUpdateItem = (index: number, field: keyof QuestionOutcomeItem, val: any) => {
    setOutcomes(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  // Kaydet
  const handleSave = async () => {
    if (outcomes.length === 0) {
      setStatusMsg({ type: 'error', text: 'Kaydedilecek kazanım verisi bulunmuyor.' });
      return;
    }

    setIsLoading(true);
    try {
      await onSaveOutcomes(exam.id, outcomes, detectedKeys);
      setStatusMsg({ type: 'success', text: 'Kazanım haritası ve cevap anahtarları başarıyla kaydedildi!' });
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: 'Kaydedilirken hata oluştu: ' + (err?.message || 'Bilinmeyen hata') });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOutcomes = selectedSubjectFilter === 'Tümü'
    ? outcomes
    : outcomes.filter(o => o.subject === selectedSubjectFilter);

  const distinctSubjects = Array.from(new Set(outcomes.map(o => o.subject))).filter(Boolean);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div 
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Başlık Çubuğu */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 bg-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xl shadow-md">
              🎯
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-serif tracking-tight">
                Sınav Kazanım & Cevap Anahtarı Yönetimi
              </h3>
              <p className="text-xs text-slate-300 font-medium">
                {exam.name} • 8. Sınıf LGS MEB Müfredat Eşleştirmesi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Durum Bildirim Bandı */}
        {statusMsg && (
          <div className={`px-5 py-2.5 text-xs font-semibold flex items-center gap-2 shrink-0 ${
            statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-b border-emerald-200' :
            statusMsg.type === 'error' ? 'bg-rose-50 text-rose-900 border-b border-rose-200' :
            'bg-amber-50 text-amber-900 border-b border-amber-200'
          }`}>
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> :
             statusMsg.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> :
             <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />}
            <span className="flex-1">{statusMsg.text}</span>
          </div>
        )}

        {/* Sekme Seçici Çubuk */}
        <div className="flex items-center gap-2 px-5 sm:px-7 pt-4 pb-2 bg-slate-50 border-b border-slate-200 shrink-0 text-xs font-bold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'upload' ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
            <span>Yayıncı XML / Excel Yükle</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ai' ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Taranmış Kitapçık PDF (Yapay Zeka)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'preview' ? 'bg-white text-slate-900 shadow-xs border border-slate-200' : 'hover:text-slate-900'
            }`}
          >
            <span>Kazanım Tablosu ({outcomes.length})</span>
          </button>
        </div>

        {/* Gövde İçerik */}
        <div className="p-5 sm:p-7 overflow-y-auto space-y-5 custom-scrollbar flex-1 bg-white">
          
          {/* TAB 1: XML / EXCEL YÜKLE */}
          {activeTab === 'upload' && (
            <div className="space-y-5">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50/70 rounded-3xl p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform shadow-xs">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Yayıncı Kazanım & Cevap Tablosunu Yükleyin
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Bilgisayarınızdan <strong>.xml (SpreadsheetML)</strong> veya <strong>.xlsx / .xls</strong> dosyasını buraya sürükleyin veya seçin.
                  </p>
                </div>
                <span className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-700 transition-colors">
                  Bilgisayardan Dosya Seç
                </span>
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept=".xml,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" 
                  className="hidden" 
                  onChange={handleSpreadsheetUpload} 
                />
              </div>

              {/* Hızlı Örnek Yayıncı Şablonları */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">🎯</span>
                    <h5 className="text-xs font-bold text-slate-900">
                      Hazır Örnek Yayıncı Şablonları (Tek Tıkla Yükle ve Test Et)
                    </h5>
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                    5 Yayıncı Destekli
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Uygulamanıza tanımlı gerçek yayıncı şablonlarını anında deneyebilir, 90 soruluk soru-kazanım ve A/B cevap anahtarlarının kusursuz eşleşmesini görebilirsiniz:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleLoadSampleXml('/assets/aistudio/20251210171926-6918-8.SINIF_BILFEN_SUREC_IZLEME-2_f53e7063.xml', 'Bilfen Süreç İzleme-2')}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-xs transition-all text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      B
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">Bilfen Süreç İzleme-2</div>
                      <div className="text-[10px] text-slate-500 truncate">Blok formatı • 90 soru • A/B Anahtar</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadSampleXml('/assets/aistudio/20260602090703-7387-CANTA_8_SDS-5_KAZANIM-CA-CAPRAZ_e60d3ea1.xml', 'Çanta SDS-5')}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-xs transition-all text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                      Ç
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">Çanta SDS-5</div>
                      <div className="text-[10px] text-slate-500 truncate">Çapraz A/B • 90 soru • MEB Kodları</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadSampleXml('/assets/aistudio/20261103194113-7123-8.SINIF_GELISIM_IZLEME_1_KAZANIM_TABLOSU_CEVAP_ANAHTARLI_5c858357.xml', 'İşleyen Zeka Gelişim 1')}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-xs transition-all text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      İZ
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">İşleyen Zeka Gelişim 1</div>
                      <div className="text-[10px] text-slate-500 truncate">Gelişim İzleme • 90 soru • Tam Eşleme</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadSampleXml('/assets/aistudio/20260521091938-9423-ankara_8._sinif_lgs_9.deneme__1_kala__20260519134033548_848584db.xml', 'Ankara 9. Deneme (1 Kala)')}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-xs transition-all text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                      A
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">Ankara 9 (1 Kala)</div>
                      <div className="text-[10px] text-slate-500 truncate">Çoklu MEB kodu • 90 soru • A/B</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadSampleXml('/assets/aistudio/20261026100419-1688-8.SINIF_MOZAIK_TG_1_KAZANIM_TABLOSU_CEVAP_ANAHTARLI_b0aa50f7.xml', 'Mozaik TG-1')}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-xs transition-all text-left cursor-pointer group sm:col-span-2 lg:col-span-1"
                  >
                    <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                      M
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">Mozaik TG-1</div>
                      <div className="text-[10px] text-slate-500 truncate">Türkiye Geneli • 90 soru • A/B</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2 text-slate-600">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Info className="w-4 h-4 text-indigo-600" />
                  <span>Otomatik Tanınan Özellikler:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                  <li><strong>A ve B Kitapçığı Cevap Anahtarları:</strong> Tek adımda 90 sorunun anahtarları sınav kartına otomatik işlenir.</li>
                  <li><strong>MEB Resmi Kazanım Kodları:</strong> 8.3.2.1, 8.1.1.2 gibi standart kazanım kodları ve metinleri eksiksiz ayrıştırılır.</li>
                  <li><strong>Hafif & Hızlı:</strong> Sadece metin kodları kaydedildiği için veritabanına binen yük sıfırdır.</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: TARANMIŞ PDF İLE YAPAY ZEKA */}
          {activeTab === 'ai' && (
            <div className="space-y-5">
              <div 
                onClick={() => pdfInputRef.current?.click()}
                className="border-2 border-dashed border-amber-300 hover:border-amber-400 bg-amber-50/40 hover:bg-amber-50/70 rounded-3xl p-7 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform shadow-xs">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Taranmış Sınav Kitapçığı veya Cevap Anahtarı PDF'i Yükleyin
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Eğer denemenin hazır Excel kazanım dosyası yoksa, taranmış PDF'ini yükleyin. Yapay zeka MEB 8. sınıf kazanım ağacıyla soruları otomatik eşleştirsin.
                  </p>
                </div>
                <span className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-xl text-xs font-bold shadow-xs hover:from-amber-600 hover:to-amber-700 transition-colors">
                  Taranmış PDF Seç
                </span>
                <input 
                  ref={pdfInputRef} 
                  type="file" 
                  accept="application/pdf" 
                  className="hidden" 
                  onChange={handlePdfUpload} 
                />
              </div>

              {/* Hızlı Test: Yüklü PDF Örnekleri */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <h5 className="text-xs font-bold text-slate-900">
                      Hazır Örnek Kitapçık PDF'leri (AI Analizini Test Edin)
                    </h5>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                    Gemini 3.8 Flash
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Uygulamanızdaki taranmış kitapçık PDF'lerini seçerek yapay zekanın soruları MEB kazanımlarıyla nasıl eşleştirdiğini doğrudan test edebilirsiniz:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleLoadSamplePdf('s_zel_1d220d29.pdf', 'Sözel Bölüm Kitapçığı')}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-amber-200 hover:border-amber-400 hover:shadow-xs transition-all text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                      S
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">Sözel Kitapçığı (PDF)</div>
                      <div className="text-[10px] text-slate-500 truncate">Türkçe, İnkılap, Din, İngilizce (1-50)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadSamplePdf('say_sal_0d8ac917.pdf', 'Sayısal Bölüm Kitapçığı')}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-amber-200 hover:border-amber-400 hover:shadow-xs transition-all text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-800 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      M
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">Sayısal Kitapçığı (PDF)</div>
                      <div className="text-[10px] text-slate-500 truncate">Matematik & Fen Bilimleri (51-90)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadSamplePdf('20261103194121-9079-8.SINIF_GELISIM_IZLEME_1_ORNEK_PDF_2de1d163.pdf', 'İşleyen Zeka Gelişim İzleme 1')}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-amber-200 hover:border-amber-400 hover:shadow-xs transition-all text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      IZ
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">İşleyen Zeka Kitapçık (PDF)</div>
                      <div className="text-[10px] text-slate-500 truncate">32 Sayfa Tam Kitapçık (90 Soru)</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLoadSamplePdf('20261024161327-1318-8.SINIF_MOZAIK_TG_1_CEVAP_ANAHTARI_83ec6eb7.pdf', 'Mozaik TG-1 Cevap Anahtarı')}
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-amber-200 hover:border-amber-400 hover:shadow-xs transition-all text-left cursor-pointer group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-xs shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                      CA
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">Mozaik TG-1 Cevap Anahtarı</div>
                      <div className="text-[10px] text-slate-500 truncate">Taranmış A/B Anahtar Sayfası</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 text-xs space-y-1.5 text-amber-950">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Yapay Zeka Nasıl Çalışır?
                </p>
                <p className="text-amber-900/80 leading-relaxed">
                  Sunucu tarafındaki <strong>Gemini 3.8 Flash</strong> modeli, PDF sayfalarındaki soru köklerini inceler; sistemde yüklü olan MEB LGS Türkçe, Matematik, Fen, İnkılap, Din ve İngilizce kazanımları arasından en isabetlisini seçerek önizleme tablosuna yerleştirir.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: ÖNİZLEME & DÜZENLEME TABLOSU */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Soru - Kazanım Eşleştirme Listesi ({outcomes.length} Soru)
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    {detectedKeys?.B ? 'A ve B Kitapçığı karşılıkları tanımlı' : 'A Kitapçığı sırasıyla listeleniyor'}
                  </p>
                </div>

                {/* Branş Filtresi */}
                {distinctSubjects.length > 1 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-slate-500 font-medium">Branş:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSubjectFilter('Tümü')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        selectedSubjectFilter === 'Tümü' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Tümü
                    </button>
                    {distinctSubjects.map(sub => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setSelectedSubjectFilter(sub)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          selectedSubjectFilter === sub ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {filteredOutcomes.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  Henüz kazanım verisi yüklenmedi. Yukarıdaki sekmelerden XML veya PDF yükleyin.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="max-h-[50vh] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3 w-14 text-center">A No</th>
                          {detectedKeys?.B && <th className="py-2.5 px-2 w-14 text-center">B No</th>}
                          <th className="py-2.5 px-3 w-28">Ders</th>
                          <th className="py-2.5 px-2 w-14 text-center">Cevap</th>
                          <th className="py-2.5 px-3 w-28">Kazanım Kodu</th>
                          <th className="py-2.5 px-3">Kazanım Açıklaması</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredOutcomes.map((item, idx) => {
                          const realIndex = outcomes.indexOf(item);
                          return (
                            <tr key={`${item.qIndex}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">
                                {item.qIndex}
                              </td>
                              {detectedKeys?.B && (
                                <td className="py-2 px-2 text-center font-mono text-slate-500">
                                  {item.altQIndex || '-'}
                                </td>
                              )}
                              <td className="py-2 px-3 font-semibold text-slate-800">
                                {item.subject}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <input
                                  type="text"
                                  maxLength={1}
                                  value={item.correctAnswer || ''}
                                  onChange={(e) => handleUpdateItem(realIndex, 'correctAnswer', e.target.value.toUpperCase())}
                                  className="w-8 py-0.5 text-center font-mono font-bold text-indigo-700 bg-white border border-slate-200 rounded uppercase focus:ring-1 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={item.outcomeCode}
                                  onChange={(e) => handleUpdateItem(realIndex, 'outcomeCode', e.target.value)}
                                  className="w-full py-0.5 px-1.5 font-mono text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={item.outcomeDesc}
                                  onChange={(e) => handleUpdateItem(realIndex, 'outcomeDesc', e.target.value)}
                                  className="w-full py-0.5 px-1.5 text-xs text-slate-700 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Alt Aksiyon Çubuğu */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-3.5 bg-slate-50 border-t border-slate-200 shrink-0">
          <div className="text-xs text-slate-500">
            {outcomes.length > 0 ? (
              <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {outcomes.length} kazanım eşleştirmesi hazır
              </span>
            ) : (
              <span>Lütfen önce XML veya PDF yükleyin</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
            >
              Vazgeç
            </button>
            <button
              type="button"
              disabled={isLoading || outcomes.length === 0}
              onClick={handleSave}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Kazanımları Sisteme Kaydet</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
