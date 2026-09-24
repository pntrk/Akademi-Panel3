import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

interface LocalQRCodeProps {
  data: string;
  size?: number;
  className?: string;
}

export function LocalQRCode({ data, size = 150, className = '' }: LocalQRCodeProps) {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    if (!data) {
      setSrc('');
      return;
    }

    QRCode.toDataURL(data, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then(url => {
        if (isMounted) setSrc(url);
      })
      .catch(err => {
        console.warn('QRCode generation failed:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [data, size]);

  if (!src) {
    return (
      <div 
        className={`flex items-center justify-center bg-slate-50 text-[8px] font-mono text-slate-400 ${className}`}
        style={{ width: '100%', height: '100%' }}
      >
        QR
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="QR"
      className={className}
      style={{ mixBlendMode: 'multiply', width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
}

