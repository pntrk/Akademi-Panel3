import React from 'react';

/**
 * Optik form öğrenci bilgi alanı dinamik metin ölçeklendirme aracı (Text-Fit / Auto-Resize)
 * Öğrencinin adı, soyadı, numarası ve şube uzunluğuna göre yazı tipi boyutunu (font-size)
 * ve harf aralığını (letter-spacing) taşma yapmayacak şekilde otomatik hesaplar.
 */

export interface StudentTextFitResult {
  nameFontSize: string;        // React inline px, örn: "11.5px"
  nameFontSizePt: string;      // Baskı/CSS pt, örn: "8.6pt"
  nameLetterSpacing: string;   // Harf aralığı, örn: "-0.02em"
  nameLineHeight: string | number;
  noFontSize: string;          // Numara boyutu
  classFontSize: string;       // Sınıf boyutu
  metaFontSize: string;        // Etiket boyutu
  style: React.CSSProperties;  // React JSX için hazır inline style nesnesi
  printStyleStr: string;       // Yazıcı/PDF HTML şablonları için inline CSS dizesi
  noStyleStr: string;
  classStyleStr: string;
}

/**
 * İsmin uzunluğuna göre optimum font büyüklüğünü (px cinsinden) hesaplar.
 * @param name Öğrenci adı ve soyadı
 * @param maxPx Standart maksimum font boyutu (varsayılan: 13)
 * @param minPx İzin verilen minimum font boyutu (varsayılan: 8)
 */
export function getStudentNameFontSize(
  name: string | null | undefined, 
  maxPx: number = 13, 
  minPx: number = 8
): number {
  if (!name) return maxPx;
  const trimmed = name.trim();
  const len = trimmed.length;

  if (len <= 18) return maxPx; // Kısa isimler: tam boy (13px)
  if (len <= 23) return 11.5;  // Orta isimler (11.5px)
  if (len <= 28) return 10.2;  // Uzun isimler (10.2px)
  if (len <= 35) return 9.2;   // Çok uzun çift isimler (9.2px)
  
  // 36 karakterden uzun aşırı uzun isimler
  const calculated = maxPx - ((len - 18) * 0.22);
  return Math.max(minPx, Number(calculated.toFixed(1)));
}

/**
 * Öğrenci bilgi kutusundaki tüm alanlar (Ad Soyad, No, Sınıf) için
 * dinamik font ölçeklendirme ve stil nesnelerini üretir.
 */
export function getStudentInfoFit(
  studentName?: string | null,
  studentNo?: string | number | null,
  studentClass?: string | null
): StudentTextFitResult {
  const nameStr = (studentName || '').trim();
  const noStr = studentNo ? String(studentNo).trim() : '';
  const classStr = (studentClass || '').trim();

  // İsim font büyüklüğü ve harf aralığı
  const namePx = getStudentNameFontSize(nameStr, 13, 8);
  const namePt = (namePx * 0.75).toFixed(2);
  
  let letterSpacing = 'normal';
  if (nameStr.length > 30) {
    letterSpacing = '-0.03em';
  } else if (nameStr.length > 22) {
    letterSpacing = '-0.015em';
  }

  // Öğrenci numarası font boyutu
  let noPx = 12;
  if (noStr.length > 7) {
    noPx = 10;
  } else if (noStr.length > 5) {
    noPx = 11;
  }

  // Sınıf / Şube font boyutu
  let classPx = 12;
  if (classStr.length > 8) {
    classPx = 10;
  } else if (classStr.length > 5) {
    classPx = 11;
  }

  const style: React.CSSProperties = {
    fontSize: `${namePx}px`,
    letterSpacing: letterSpacing,
    lineHeight: 1.15,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };

  const printStyleStr = `font-size: ${namePx}px; letter-spacing: ${letterSpacing}; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`;
  const noStyleStr = `font-size: ${noPx}px;`;
  const classStyleStr = `font-size: ${classPx}px;`;

  return {
    nameFontSize: `${namePx}px`,
    nameFontSizePt: `${namePt}pt`,
    nameLetterSpacing: letterSpacing,
    nameLineHeight: 1.15,
    noFontSize: `${noPx}px`,
    classFontSize: `${classPx}px`,
    metaFontSize: '10px',
    style,
    printStyleStr,
    noStyleStr,
    classStyleStr
  };
}
