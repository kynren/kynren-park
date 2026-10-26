import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const out = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const GREEN_DARK = '#0F3B2A';
const GREEN = '#1F6B49';
const INK = '#0A2A1E';
const AMBER = '#E2862B';
const GOLD = '#F4BE62';
const CREAM = '#FFF3D9';

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GREEN_DARK}"/><stop offset="1" stop-color="${GREEN}"/></linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.18" r="0.7"><stop offset="0" stop-color="${GOLD}" stop-opacity="0.28"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${GOLD}"/><stop offset="1" stop-color="${AMBER}"/></linearGradient>
    <linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14503A"/><stop offset="1" stop-color="${INK}"/></linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.35"/></filter>
  </defs>`;

const background = `<rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#glow)"/>`;

// A bold K from three round-capped strokes, centred on (cx, cy), `h` tall.
function letterK(cx, cy, h, colour = CREAM, accent = null) {
  const w = h * 0.62;
  const t = h * 0.2; // stroke thickness
  const top = cy - h / 2 + t / 2, bottom = cy + h / 2 - t / 2;
  const left = cx - w / 2 + t / 2;
  const stemX = left;
  const jointY = cy + h * 0.03;
  const armEnd = [cx + w / 2 - t / 2, top];
  const legEnd = [cx + w / 2 - t / 2, bottom];
  const joint = [stemX + t * 0.55, jointY];
  const line = (a, b, stroke) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${stroke}" stroke-width="${t}" stroke-linecap="round"/>`;
  return `<g stroke-linejoin="round">
    ${line([stemX, top], [stemX, bottom], colour)}
    ${line(joint, armEnd, colour)}
    ${line([joint[0] + t * 0.25, joint[1] + t * 0.1], legEnd, accent ?? colour)}
  </g>`;
}

const star = (cx, cy, r, fill = GOLD) => {
  const k = r * 0.28;
  return `<path d="M${cx} ${cy - r} Q${cx + k} ${cy - k} ${cx + r} ${cy} Q${cx + k} ${cy + k} ${cx} ${cy + r} Q${cx - k} ${cy + k} ${cx - r} ${cy} Q${cx - k} ${cy - k} ${cx} ${cy - r} Z" fill="${fill}"/>`;
};

// ---- A: heater shield, K, a spark above it
const shieldPath = 'M512 188 L762 262 L762 524 C762 700 640 800 512 862 C384 800 262 700 262 524 L262 262 Z';
const A = `
  ${background}
  <g filter="url(#soft)">
    <path d="${shieldPath}" fill="url(#face)" stroke="url(#gold)" stroke-width="30" stroke-linejoin="round"/>
    <path d="${shieldPath}" fill="none" stroke="${GOLD}" stroke-opacity="0.35" stroke-width="3" transform="translate(512 525) scale(0.9) translate(-512 -525)"/>
  </g>
  ${letterK(512, 560, 330, CREAM, GOLD)}
  ${star(512, 332, 44)}
`;

// ---- B: round seal, K, small flame
const flame = (cx, cy, s) => `<path d="M${cx} ${cy - 62 * s} C${cx + 30 * s} ${cy - 30 * s} ${cx + 44 * s} ${cy - 6 * s} ${cx + 28 * s} ${cy + 30 * s} C${cx + 20 * s} ${cy + 48 * s} ${cx - 20 * s} ${cy + 48 * s} ${cx - 28 * s} ${cy + 30 * s} C${cx - 44 * s} ${cy - 6 * s} ${cx - 8 * s} ${cy - 24 * s} ${cx} ${cy - 62 * s} Z" fill="url(#gold)"/><path d="M${cx} ${cy - 8 * s} C${cx + 12 * s} ${cy + 6 * s} ${cx + 14 * s} ${cy + 22 * s} ${cx} ${cy + 32 * s} C${cx - 14 * s} ${cy + 22 * s} ${cx - 12 * s} ${cy + 6 * s} ${cx} ${cy - 8 * s} Z" fill="${CREAM}"/>`;
const B = `
  ${background}
  <g filter="url(#soft)">
    <circle cx="512" cy="512" r="338" fill="url(#face)" stroke="url(#gold)" stroke-width="30"/>
    <circle cx="512" cy="512" r="296" fill="none" stroke="${GOLD}" stroke-opacity="0.45" stroke-width="4" stroke-dasharray="2 14" stroke-linecap="round"/>
  </g>
  ${letterK(512, 560, 340, CREAM, GOLD)}
  ${flame(512, 330, 0.92)}
`;

// ---- C: castle shield (crenellated top), K, two stars
function castleShield() {
  const L = 262, R = 762, top = 250, merlonH = 62, n = 4;
  const w = (R - L) / (n * 2 - 1);
  let d = `M${L} ${top + merlonH}`;
  let x = L;
  d += ` L${x} ${top}`;
  for (let i = 0; i < n; i++) {
    d += ` L${x + w} ${top}`;
    x += w;
    if (i < n - 1) {
      d += ` L${x} ${top + merlonH} L${x + w} ${top + merlonH} L${x + w} ${top}`;
      x += w;
    }
  }
  d += ` L${R} ${top + merlonH} L${R} 540 C${R} 712 640 806 512 866 C384 806 ${L} 712 ${L} 540 Z`;
  return d;
}
const C = `
  ${background}
  <g filter="url(#soft)">
    <path d="${castleShield()}" fill="url(#face)" stroke="url(#gold)" stroke-width="30" stroke-linejoin="round"/>
  </g>
  ${letterK(512, 580, 320, CREAM, GOLD)}
  ${star(512, 188, 40)}
  ${star(366, 150, 20, CREAM)}
  ${star(660, 150, 20, CREAM)}
`;

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${defs}${body}</svg>`;
const variants = { a_shield: svg(A), b_seal: svg(B), c_castle: svg(C) };

for (const [name, s] of Object.entries(variants)) {
  fs.writeFileSync(path.join(out, `${name}.svg`), s);
  await sharp(Buffer.from(s)).png().toFile(path.join(out, `${name}.png`));
}

// A sheet: each variant big, then as it appears on a phone (rounded square and circle) and tiny.
const roundedMask = (size, r) => Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#fff"/></svg>`);
const circleMask = (size) => Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);
const colW = 460, W = colW * 3 + 40, H = 760;
const layers = [];
let i = 0;
for (const name of Object.keys(variants)) {
  const png = await sharp(path.join(out, `${name}.png`)).toBuffer();
  const x = 20 + i * colW;
  const big = await sharp(png).resize(400).composite([{ input: roundedMask(400, 90), blend: 'dest-in' }]).png().toBuffer();
  const rounded = await sharp(png).resize(120).composite([{ input: roundedMask(120, 27), blend: 'dest-in' }]).png().toBuffer();
  const circle = await sharp(png).resize(120).composite([{ input: circleMask(120), blend: 'dest-in' }]).png().toBuffer();
  const small = await sharp(png).resize(48).composite([{ input: roundedMask(48, 11), blend: 'dest-in' }]).png().toBuffer();
  layers.push({ input: big, left: x + 10, top: 30 }, { input: rounded, left: x + 10, top: 470 }, { input: circle, left: x + 150, top: 470 }, { input: small, left: x + 290, top: 506 });
  i += 1;
}
await sharp({ create: { width: W, height: H, channels: 4, background: '#F3F1EA' } }).composite(layers).png().toFile(path.join(out, 'sheet.png'));
console.log('done', Object.keys(variants).join(', '));
