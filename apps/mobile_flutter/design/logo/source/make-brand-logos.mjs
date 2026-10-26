import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const src = 'C:/Users/boamponsem/Documents/kynenParkApp/apps/mobile/assets/kynren-wordmark.webp';
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

// Same component split as split-wordmark.mjs: the K is the biggest shape, the red cross the small one at the far right.
const label = new Int32Array(W * H);
const boxes = [];
const stack = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (label[i] || data[i * 4 + 3] <= 24) continue;
    const id = boxes.length + 1;
    const b = { id, minX: x, maxX: x, minY: y, maxY: y, n: 0 };
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const j = stack.pop();
      const px = j % W, py = (j - px) / W;
      b.n++;
      b.minX = Math.min(b.minX, px); b.maxX = Math.max(b.maxX, px);
      b.minY = Math.min(b.minY, py); b.maxY = Math.max(b.maxY, py);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = px + dx, ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const k = ny * W + nx;
        if (!label[k] && data[k * 4 + 3] > 24) { label[k] = id; stack.push(k); }
      }
    }
    boxes.push(b);
  }
}
const K = boxes.find((b) => b.minX < 50 && b.n > 30000);
const CROSS = boxes.find((b) => b.minX > 1400);

async function cut(box, pad = 6) {
  const w = box.maxX - box.minX + 1 + pad * 2, h = box.maxY - box.minY + 1 + pad * 2;
  const out = Buffer.alloc(w * h * 4);
  for (let y = box.minY; y <= box.maxY; y++) {
    for (let x = box.minX; x <= box.maxX; x++) {
      const i = y * W + x;
      if (label[i] !== box.id) continue;
      const o = ((y - box.minY + pad) * w + (x - box.minX + pad)) * 4;
      out[o] = data[i * 4]; out[o + 1] = data[i * 4 + 1]; out[o + 2] = data[i * 4 + 2]; out[o + 3] = data[i * 4 + 3];
    }
  }
  return { buf: await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer(), w, h };
}
const k = await cut(K);
const cross = await cut(CROSS);
fs.writeFileSync(path.join(here, 'K-cut.png'), k.buf);
fs.writeFileSync(path.join(here, 'cross-cut.png'), cross.buf);
// where the cross sits relative to the K in the wordmark itself (K's top-right), as a fraction of K's size
console.log('K', k.w, k.h, 'cross', cross.w, cross.h);

const SIZE = 1024;
// Lay the K and cross out on the canvas: K width is `kw`; the cross keeps the wordmark's proportions and sits at the K's upper right.
async function monogram({ kw, cx, cy, crossScale = 1.05 }) {
  const scale = kw / k.w;
  const kb = await sharp(k.buf).resize({ width: Math.round(kw) }).png().toBuffer();
  const kh = Math.round(k.h * scale);
  const left = Math.round(cx - kw / 2), top = Math.round(cy - kh / 2);
  const cw = Math.round(cross.w * scale * crossScale);
  const cb = await sharp(cross.buf).resize({ width: cw }).png().toBuffer();
  const ch = Math.round(cross.h * scale * crossScale);
  const shadow = async (buf) => sharp(buf).ensureAlpha().modulate({ brightness: 0 }).blur(10).linear(0.55, 0).png().toBuffer();
  return [
    { input: await shadow(kb), left: left + 4, top: top + 12 },
    { input: kb, left, top },
    { input: cb, left: Math.round(left + kw * 0.9), top: Math.round(top - ch * 0.3) },
  ];
}

const svgBg = (inner) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 1024 1024">${inner}</svg>`);
const stars = Array.from({ length: 46 }, (_, i) => {
  const r = (n) => ((Math.sin(i * 91.7 + n * 13.3) * 10000) % 1 + 1) % 1;
  return `<circle cx="${Math.round(r(1) * 1024)}" cy="${Math.round(r(2) * 560)}" r="${(0.8 + r(3) * 2.2).toFixed(1)}" fill="#fff" opacity="${(0.25 + r(4) * 0.6).toFixed(2)}"/>`;
}).join('');

const backgrounds = {
  green: svgBg(`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b6e53"/><stop offset="1" stop-color="#1b3d2c"/></linearGradient>
    <radialGradient id="h" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>
    <rect width="1024" height="1024" fill="url(#g)"/><rect width="1024" height="1024" fill="url(#h)"/>`),
  night: svgBg(`<defs><linearGradient id="n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070b1d"/><stop offset="0.62" stop-color="#1c2349"/><stop offset="1" stop-color="#4a2a4d"/></linearGradient>
    <radialGradient id="f" cx="0.5" cy="1.05" r="0.75"><stop offset="0" stop-color="#e2862b" stop-opacity="0.5"/><stop offset="1" stop-color="#e2862b" stop-opacity="0"/></radialGradient></defs>
    <rect width="1024" height="1024" fill="url(#n)"/>${stars}<rect width="1024" height="1024" fill="url(#f)"/>`),
  black: svgBg(`<defs><radialGradient id="b" cx="0.5" cy="0.42" r="0.75"><stop offset="0" stop-color="#2a2d33"/><stop offset="1" stop-color="#0c0d10"/></radialGradient></defs><rect width="1024" height="1024" fill="url(#b)"/>`),
};

const layout = await monogram({ kw: 600, cx: 462, cy: 572, crossScale: 1.2 });
const outputs = {};
for (const [name, bg] of Object.entries(backgrounds)) {
  const file = path.join(here, `brand_${name}.png`);
  await sharp(bg).composite(layout).png().toFile(file);
  outputs[name] = file;
}

// Adaptive-icon foreground: transparent, with the K and cross together centred and small enough that the cross clears the
// circular crop (the visible circle is the central 66% of the canvas). The group is about 1.27 K-widths wide and sits
// 0.135 K-widths right of, and 0.05 above, the K centre.
const FG_KW = 400;
const fgLayout = await monogram({ kw: FG_KW, cx: 512 - 0.135 * FG_KW, cy: 512 + 0.05 * FG_KW, crossScale: 1.2 });
await sharp({ create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(fgLayout).png().toFile(path.join(here, 'adaptive_foreground.png'));

// Comparison sheet
const roundedMask = (s, r) => Buffer.from(`<svg width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${r}" fill="#fff"/></svg>`);
const circleMask = (s) => Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="#fff"/></svg>`);
const colW = 460, sheetW = colW * 3 + 40, sheetH = 640;
const layers = [];
let i = 0;
for (const name of Object.keys(outputs)) {
  const png = await sharp(outputs[name]).toBuffer();
  const x = 20 + i * colW;
  layers.push(
    { input: await sharp(png).resize(400).composite([{ input: roundedMask(400, 90), blend: 'dest-in' }]).png().toBuffer(), left: x + 10, top: 30 },
    { input: await sharp(png).resize(120).composite([{ input: roundedMask(120, 27), blend: 'dest-in' }]).png().toBuffer(), left: x + 10, top: 470 },
    { input: await sharp(png).resize(120).composite([{ input: circleMask(120), blend: 'dest-in' }]).png().toBuffer(), left: x + 150, top: 470 },
    { input: await sharp(png).resize(48).composite([{ input: roundedMask(48, 11), blend: 'dest-in' }]).png().toBuffer(), left: x + 290, top: 506 },
  );
  i += 1;
}
await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: '#F3F1EA' } }).composite(layers).png().toFile(path.join(here, 'brand_sheet.png'));
console.log('done');
