/**
 * Génère les icônes PWA (PNG) à partir d'un SVG embarqué.
 * Nécessite `sharp` en devDep : `npm i -D sharp` puis `node scripts/gen-pwa-icons.cjs`.
 * Les PNG produits sont committés ; sharp n'est pas requis au build.
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#4f46e5"/>
  <path d="M96 416 L416 256 L96 96 L96 224 L300 256 L96 288 Z" fill="#ffffff"/>
</svg>`;

const out = path.join(__dirname, '..', 'public');
fs.mkdirSync(out, { recursive: true });
const buf = Buffer.from(svg);

(async () => {
  await sharp(buf).resize(192, 192).png().toFile(path.join(out, 'pwa-192x192.png'));
  await sharp(buf).resize(512, 512).png().toFile(path.join(out, 'pwa-512x512.png'));
  await sharp(buf).resize(512, 512).png().toFile(path.join(out, 'maskable-512x512.png'));
  await sharp(buf).resize(180, 180).png().toFile(path.join(out, 'apple-touch-icon.png'));
  fs.writeFileSync(path.join(out, 'icon.svg'), svg);
  console.log('PWA icons generated in public/');
})();
