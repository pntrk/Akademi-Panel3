const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

// 1. Regular Icon SVG (Full emblem with subtle rounded edge or full-bleed)
const createIconSvg = (isMaskable = false) => {
  // For maskable icon: safe zone is central 80% circle (radius ~204px).
  // Background must bleed to all 4 edges (no rounded corners).
  const scale = isMaskable ? 0.78 : 0.88;
  const translate = isMaskable ? (512 * (1 - scale)) / 2 : (512 * (1 - scale)) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="appBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#080c16" />
      <stop offset="45%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#050811" />
    </linearGradient>

    <!-- Glowing Accent Orbs -->
    <radialGradient id="glowEmerald" cx="25%" cy="20%" r="65%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.32" />
      <stop offset="100%" stop-color="#10b981" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowSky" cx="80%" cy="80%" r="60%">
      <stop offset="0%" stop-color="#0284c7" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#0284c7" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="glowCenter" cx="50%" cy="50%" r="40%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
    </radialGradient>

    <!-- Gold Accent Gradient -->
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="35%" stop-color="#fbbf24" />
      <stop offset="75%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#b45309" />
    </linearGradient>

    <!-- Emerald-Sky Gradient -->
    <linearGradient id="capGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="40%" stop-color="#10b981" />
      <stop offset="85%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>

    <!-- Shield Inner Gradient -->
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="50%" stop-color="#111827" />
      <stop offset="100%" stop-color="#0b0f19" />
    </linearGradient>

    <!-- Outer Border Gradient -->
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" stop-opacity="0.75" />
      <stop offset="50%" stop-color="#38bdf8" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.65" />
    </linearGradient>

    <!-- Drop Shadow -->
    <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000000" flood-opacity="0.75" />
    </filter>
  </defs>

  <!-- Base Full-Bleed Canvas Background -->
  <rect width="512" height="512" ${isMaskable ? '' : 'rx="112"'} fill="url(#appBg)" />
  <rect width="512" height="512" ${isMaskable ? '' : 'rx="112"'} fill="url(#glowEmerald)" />
  <rect width="512" height="512" ${isMaskable ? '' : 'rx="112"'} fill="url(#glowSky)" />
  <rect width="512" height="512" ${isMaskable ? '' : 'rx="112"'} fill="url(#glowCenter)" />

  ${!isMaskable ? '<rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="url(#borderGrad)" stroke-width="4" />' : ''}

  <!-- Emblem Center Group (scaled to safe zone if maskable) -->
  <g transform="translate(${translate}, ${translate}) scale(${scale})" filter="url(#dropShadow)">
    
    <!-- Shield / Crest Background -->
    <path d="M 256 70 
             C 345 70, 396 95, 396 95 
             V 245 
             C 396 348, 320 416, 256 442 
             C 192 416, 116 348, 116 245 
             V 95 
             C 116 95, 167 70, 256 70 Z" 
          fill="url(#shieldGrad)" 
          stroke="url(#capGrad)" 
          stroke-width="7" />

    <!-- Inner Shield Accent Line -->
    <path d="M 256 86 
             C 332 86, 376 108, 376 108 
             V 238 
             C 376 328, 310 388, 256 414 
             C 202 388, 136 328, 136 238 
             V 108 
             C 136 108, 180 86, 256 86 Z" 
          fill="none" 
          stroke="url(#goldGrad)" 
          stroke-width="2.5" 
          stroke-opacity="0.5" />

    <!-- Graduation Cap Diamond Top -->
    <polygon points="256,128 388,186 256,244 124,186" 
             fill="url(#capGrad)" 
             stroke="url(#goldGrad)" 
             stroke-width="3" />

    <!-- Cap Skull Base Arch -->
    <path d="M 180 214 
             V 264 
             C 180 292, 214 314, 256 314 
             C 298 314, 332 292, 332 264 
             V 214" 
          fill="none" 
          stroke="url(#capGrad)" 
          stroke-width="12" 
          stroke-linecap="round" />

    <!-- Cap Button / Center Jewel -->
    <circle cx="256" cy="186" r="10" fill="url(#goldGrad)" />

    <!-- Golden Tassel String & Pendant -->
    <path d="M 256 186 Q 320 188 388 236 V 286" 
          fill="none" 
          stroke="url(#goldGrad)" 
          stroke-width="6" 
          stroke-linecap="round" />
    <circle cx="388" cy="298" r="12" fill="url(#goldGrad)" />

    <!-- Center Academic Star / Achievement Medallion -->
    <g transform="translate(256, 350)">
      <!-- Outer Glow Ring -->
      <circle cx="0" cy="0" r="32" fill="#0f172a" stroke="url(#capGrad)" stroke-width="4" />
      <!-- Star -->
      <path d="M 0 -22 
               L 6.8 -8 
               L 22 -6 
               L 11 5 
               L 13.6 20 
               L 0 13 
               L -13.6 20 
               L -11 5 
               L -22 -6 
               L -6.8 -8 Z" 
            fill="url(#goldGrad)" />
    </g>

    <!-- Bottom Brand Title Banner Arc / Text -->
    <text x="256" y="482" 
          text-anchor="middle" 
          font-family="system-ui, -apple-system, sans-serif" 
          font-size="28" 
          font-weight="900" 
          letter-spacing="4" 
          fill="#38bdf8">
      AKADEMİ
    </text>
  </g>
</svg>`;
};

// 2. Apple Touch Icon SVG (180x180 square full bleed, iOS will round corners)
const createAppleTouchSvg = () => {
  return createIconSvg(false);
};

async function main() {
  const publicDir = path.resolve(__dirname, '../public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Write icon.svg (standard)
  const standardSvg = createIconSvg(false);
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), standardSvg, 'utf8');
  console.log('✓ Wrote public/icon.svg');

  // 2. Write icon-maskable.svg
  const maskableSvg = createIconSvg(true);
  fs.writeFileSync(path.join(publicDir, 'icon-maskable.svg'), maskableSvg, 'utf8');
  console.log('✓ Wrote public/icon-maskable.svg');

  // 3. Render 512x512 standard PNG
  const resvg512 = new Resvg(standardSvg, { fitTo: { mode: 'width', value: 512 } });
  const png512 = resvg512.render().asPng();
  fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);
  console.log(`✓ Generated public/pwa-512x512.png (${png512.length} bytes)`);

  // 4. Render 192x192 standard PNG
  const resvg192 = new Resvg(standardSvg, { fitTo: { mode: 'width', value: 192 } });
  const png192 = resvg192.render().asPng();
  fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);
  console.log(`✓ Generated public/pwa-192x192.png (${png192.length} bytes)`);

  // 5. Render 512x512 maskable PNG (with safe-zone margin)
  const resvgMaskable = new Resvg(maskableSvg, { fitTo: { mode: 'width', value: 512 } });
  const pngMaskable = resvgMaskable.render().asPng();
  fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pngMaskable);
  console.log(`✓ Generated public/pwa-maskable-512x512.png (${pngMaskable.length} bytes)`);

  // 6. Render Apple Touch Icon (180x180 PNG)
  const resvgApple = new Resvg(standardSvg, { fitTo: { mode: 'width', value: 180 } });
  const pngApple = resvgApple.render().asPng();
  fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), pngApple);
  console.log(`✓ Generated public/apple-touch-icon.png (${pngApple.length} bytes)`);

  // 7. Render 32x32 & 16x16 Favicon PNGs
  const resvg32 = new Resvg(standardSvg, { fitTo: { mode: 'width', value: 32 } });
  const png32 = resvg32.render().asPng();
  fs.writeFileSync(path.join(publicDir, 'favicon-32x32.png'), png32);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), png32);
  console.log(`✓ Generated public/favicon.ico & favicon-32x32.png`);

  // 8. Generate static manifest.json and manifest.webmanifest for 100% browser compatibility
  const manifestData = {
    id: '/',
    name: 'AkademiPanel • Sınav & Ölçme Değerlendirme',
    short_name: 'AkademiPanel',
    description: 'Okul Sınav, Salon, Öğrenci ve Ölçme Değerlendirme Yönetim Paneli',
    theme_color: '#151618',
    background_color: '#0f172a',
    display: 'standalone',
    orientation: 'any',
    start_url: '/',
    scope: '/',
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any'
      }
    ]
  };

  const manifestJsonStr = JSON.stringify(manifestData, null, 2);
  fs.writeFileSync(path.join(publicDir, 'manifest.json'), manifestJsonStr, 'utf8');
  fs.writeFileSync(path.join(publicDir, 'manifest.webmanifest'), manifestJsonStr, 'utf8');
  console.log('✓ Wrote public/manifest.json and public/manifest.webmanifest');
}

main().catch(err => {
  console.error('Error in generating icons:', err);
  process.exit(1);
});
