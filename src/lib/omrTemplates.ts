/**
 * Optical Form Template Specifications
 * Supports:
 * 1. Standard QR-Coded Personalized Optical Sheets (Akademi Panel default)
 * 2. Ertem Optik-840 (Preprinted standard İlkokul - Ortaokul Cevap Kağıdı)
 */

export type OpticalTemplateType = 'standard_qr' | 'ertem_840';

export interface OpticalTemplateInfo {
  id: OpticalTemplateType;
  title: string;
  subtitle: string;
  isInternalOnly: boolean;
  hasQrCode: boolean;
  hasTimingTrack: boolean;
  optionsPerQuestion: number;
  booklets: string[];
}

export const OPTICAL_TEMPLATES: Record<OpticalTemplateType, OpticalTemplateInfo> = {
  standard_qr: {
    id: 'standard_qr',
    title: 'Akıllı Karekodlu Form',
    subtitle: 'Sistem tarafından kişiselleştirilmiş çıktılar (Karekod & 4 Köşe Çapası)',
    isInternalOnly: false,
    hasQrCode: true,
    hasTimingTrack: false,
    optionsPerQuestion: 4,
    booklets: ['A', 'B', 'C', 'D']
  },
  ertem_840: {
    id: 'ertem_840',
    title: 'Ertem Optik-840',
    subtitle: 'Standart basılı optik form (Sol zamanlama çubuğu, 6 haneli No, 20 sütun İsim, LGS 6 ders)',
    isInternalOnly: true,
    hasQrCode: false,
    hasTimingTrack: true,
    optionsPerQuestion: 4,
    booklets: ['A', 'B']
  }
};

/**
 * Milimetric specs for Ertem Optik-840 on A4 (210 x 297 mm)
 */
export const ERTEM_840_SPECS = {
  paperW: 210,
  paperH: 297,

  // Left timing track
  timingTrack: {
    x: 6.5,
    w: 4.2,
    startY: 32.0,
    endY: 286.0,
    markCount: 38
  },

  // Student number (6 columns x 10 digits [0-9])
  studentNo: {
    x: 147.0,
    y: 25.5,
    w: 24.0,
    h: 30.0,
    cols: 6,
    colGap: 3.8,
    rowGap: 2.8,
    radius: 1.4
  },

  // Student Name & Surname (20 columns x 29 Turkish letters)
  studentName: {
    x: 14.5,
    y: 53.5,
    w: 86.0,
    h: 78.0,
    cols: 20,
    rows: 29,
    colGap: 4.1,
    rowGap: 2.6,
    radius: 1.2
  },

  // Booklet type (A, B)
  booklet: {
    x: 180.0,
    y: 33.5,
    bubbles: [
      { label: 'A', x: 178.5, y: 34.0 },
      { label: 'B', x: 186.5, y: 34.0 }
    ],
    radius: 1.6
  },

  // 4-8. Classes Answer Area (LGS 6 subjects x 20 questions x 4 options [A, B, C, D])
  answers4to8: {
    startY: 172.5,
    rowH: 4.85,
    bubbleGap: 4.2,
    radius: 1.5,
    subjects: [
      { id: 'turkce', name: 'Türkçe', colX: 74.0, count: 20 },
      { id: 'sosyal', name: 'Sosyal Bilgiler', colX: 97.0, count: 20 },
      { id: 'din', name: 'Din Kültürü', colX: 120.0, count: 20 },
      { id: 'ingilizce', name: 'İngilizce', colX: 143.0, count: 20 },
      { id: 'matematik', name: 'Matematik', colX: 167.0, count: 20 },
      { id: 'fen', name: 'Fen Bilimleri', colX: 190.0, count: 20 }
    ]
  }
};
