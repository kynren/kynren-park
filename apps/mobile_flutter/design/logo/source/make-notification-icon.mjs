// Android draws a notification's small icon as a flat silhouette (only the shape's transparency matters), so the
// full-colour K can't be used there: this makes a 96x96 white K with its cross, on transparent.
// Run from apps/mobile_flutter:  node design/logo/source/make-notification-icon.mjs   (needs `sharp`, e.g. from any node_modules)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(process.env.SHARP_FROM ?? import.meta.url);
const sharp = require('sharp');

const SIZE = 96;
const white = async (file, width) => {
  const { data, info } = await sharp(file).resize({ width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255; data[i + 1] = 255; data[i + 2] = 255;
    data[i + 3] = data[i + 3] > 40 ? Math.min(255, data[i + 3] * 1.6) : 0; // firm up the engraved edges
  }
  return { buf: await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer(), w: info.width, h: info.height };
};

const k = await white('design/logo/brand/K-cut.png', 70);
const cross = await white('design/logo/brand/cross-cut.png', 24);
await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: k.buf, left: 8, top: Math.round((SIZE - k.h) / 2) + 6 },
    { input: cross.buf, left: 8 + 70 - 12, top: Math.round((SIZE - k.h) / 2) + 6 - 8 },
  ])
  .png()
  .toFile('assets/icon/notification-icon.png');
console.log('notification icon written');
