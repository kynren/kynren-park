/**
 * Generates branded app icons + splash as valid PNGs with no image library —
 * a solid Kynren-red field with a white heraldic diamond mark (the "◈").
 * Run: node assets/generate-assets.mjs
 */
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const BRAND = [0x8f, 0x1d, 0x21]; // Kynren red
const WHITE = [0xff, 0xff, 0xff];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // no filter
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Draw: background (or transparent) + a white diamond mark centred.
function draw({ size, bg, mark = WHITE, transparent = false, markScale = 0.42 }) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * markScale; // diamond "radius" (Manhattan)
  const inner = r * 0.62;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let col = bg;
      let a = transparent ? 0 : 255;
      const d = Math.abs(x - cx) + Math.abs(y - cy); // diamond distance
      if (d < r && d > inner) {
        col = mark; // diamond ring
        a = 255;
      }
      rgba[i] = col[0];
      rgba[i + 1] = col[1];
      rgba[i + 2] = col[2];
      rgba[i + 3] = a;
    }
  }
  return encodePng(size, size, rgba);
}

const outDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const write = (name, buf) => {
  fs.writeFileSync(path.join(outDir, name), buf);
  console.log(`  ${name} (${(buf.length / 1024).toFixed(1)} KB)`);
};

console.log('Generating brand assets:');
write('icon.png', draw({ size: 1024, bg: BRAND }));
write('adaptive-icon.png', draw({ size: 1024, bg: BRAND, markScale: 0.34 })); // safe area
write('splash.png', draw({ size: 1242, bg: BRAND, markScale: 0.26 }));
write('favicon.png', draw({ size: 48, bg: BRAND, markScale: 0.42 }));
write('notification-icon.png', draw({ size: 96, bg: [0, 0, 0], mark: WHITE, transparent: true, markScale: 0.42 }));
console.log('Done.');
