// Generates App Store / Play Store screenshots at 1290×2796 (iPhone 6.7").
// Pure SVG → PNG via @resvg/resvg-js (installed in the scratchpad). Run:
//   node apps/mobile/store/make-screenshots.mjs
// Marketing screenshots built from the app's real brand + screen designs.
// resvg lives in the session scratchpad (dev-only tool, not an app dependency).
const RESVG = process.env.RESVG_PATH || '@resvg/resvg-js';
const { Resvg } = await import(RESVG);
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'screenshots');
mkdirSync(OUT, { recursive: true });

const W = 1290, H = 2796;
// Brand palette (matches the app / splash).
const PLUM0 = '#2a1846', PLUM1 = '#1a1030', PLUM2 = '#0a0616';
const BRAND = '#a5232a', BRAND_D = '#7c171d', GOLD = '#f0d79a', GOLD_D = '#d9a441';
const INK = '#2a2320', MUTED = '#8a8178', PAPER = '#f5f2ec', LINE = '#e7e1d6';
const FONT = 'Segoe UI, Arial, Helvetica, sans-serif';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const t = (x, y, s, { size = 40, w = 400, fill = INK, anchor = 'start', ls = 0, op = 1 } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${w}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" opacity="${op}">${esc(s)}</text>`;
const rr = (x, y, w, h, r, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;

// Phone geometry (device mockup within the poster).
const PW = 908, PB = 20;                 // phone width, bezel
const PX = (W - PW) / 2, PY = 690;       // phone top-left
const PH = Math.round((PW - PB * 2) * 2.165) + PB * 2;
const SX = PX + PB, SY = PY + PB, SW = PW - PB * 2, SH = PH - PB * 2; // inner screen

// ---- generic in-screen UI helpers (coords are absolute) ----
const statusBar = () =>
  t(SX + 34, SY + 58, '9:41', { size: 30, w: 700, fill: INK }) +
  rr(SX + SW - 150, SY + 40, 44, 22, 6, INK) + rr(SX + SW - 96, SY + 40, 30, 22, 6, INK) +
  rr(SX + SW - 58, SY + 38, 40, 24, 6, INK);
const header = (title, sub) =>
  t(SX + 34, SY + 132, title, { size: 46, w: 800, fill: INK }) +
  (sub ? t(SX + 34, SY + 176, sub, { size: 27, w: 500, fill: MUTED }) : '');

function chip(x, y, label, { fill = BRAND, tc = '#fff', wpx } = {}) {
  const w = wpx ?? (26 + label.length * 15);
  return rr(x, y, w, 46, 23, fill) + t(x + w / 2, y + 31, label, { size: 24, w: 700, fill: tc, anchor: 'middle' });
}

// A deterministic QR-looking matrix (finder patterns + pseudo-random modules).
function qr(cx, cy, size) {
  const n = 25, m = size / n;
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let out = rr(cx - 24, cy - 24, size + 48, size + 48, 24, '#fff'); // quiet zone
  const finder = (fx, fy) =>
    rr(fx, fy, m * 7, m * 7, 8, INK) + rr(fx + m, fy + m, m * 5, m * 5, 6, '#fff') + rr(fx + m * 2, fy + m * 2, m * 3, m * 3, 4, INK);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const inFinder = (r < 8 && c < 8) || (r < 8 && c > n - 9) || (r > n - 9 && c < 8);
    if (inFinder) continue;
    if (rnd() > 0.52) out += rr(cx + c * m, cy + r * m, m, m, 1, INK);
  }
  out += finder(cx, cy) + finder(cx + m * (n - 7), cy) + finder(cx, cy + m * (n - 7));
  return out;
}

// ---- screen 1: itinerary planner ----
function screenPlanner() {
  let s = statusBar() + header('Today at Kynren', 'Tue 21 Jul · 5 shows planned');
  // hero card
  const hy = SY + 214;
  s += `<defs><linearGradient id="hero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BRAND}"/><stop offset="1" stop-color="${BRAND_D}"/></linearGradient></defs>`;
  s += rr(SX + 30, hy, SW - 60, 210, 28, 'url(#hero)');
  s += t(SX + 62, hy + 74, 'YOUR OPTIMISED ROUTE', { size: 24, w: 800, fill: GOLD, ls: 2 });
  s += t(SX + 62, hy + 138, 'A clash-free day, timed', { size: 44, w: 800, fill: '#fff' });
  s += t(SX + 62, hy + 182, 'Walking distances included · reminders set', { size: 25, w: 500, fill: '#f6d9db' });
  // timeline rows
  const rows = [
    ['11:00', 'The Lost Feather', 'Birds of prey · 25 min'],
    ['12:30', 'Legend of the Wear', 'Lakeside show · 4 min walk'],
    ['14:15', 'Land of the Vikings', 'Longship battle · 6 min walk'],
    ['16:00', 'Victorian Imaginariums', 'The maze · 3 min walk'],
  ];
  let ry = hy + 268;
  rows.forEach(([time, name, meta], i) => {
    s += `<circle cx="${SX + 70}" cy="${ry + 40}" r="14" fill="${BRAND}"/>`;
    if (i < rows.length - 1) s += `<rect x="${SX + 66}" y="${ry + 58}" width="8" height="118" fill="${LINE}"/>`;
    s += rr(SX + 108, ry, SW - 168, 156, 24, '#fff', `stroke="${LINE}" stroke-width="2"`);
    s += chip(SX + 132, ry + 26, time, { fill: '#efe7d6', tc: BRAND_D });
    s += t(SX + 132, ry + 106, name, { size: 36, w: 800, fill: INK });
    s += t(SX + 132, ry + 142, meta, { size: 25, w: 500, fill: MUTED });
    ry += 186;
  });
  return s;
}

// ---- screen 2: offline park map ----
function screenMap() {
  const gx = SX, gy = SY, gw = SW, gh = SH;
  let s = `<clipPath id="scr"><rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="4"/></clipPath><g clip-path="url(#scr)">`;
  s += rr(gx, gy, gw, gh, 0, '#a9c97f');
  // soft meadows
  s += `<ellipse cx="${gx + 180}" cy="${gy + 360}" rx="360" ry="240" fill="#9dc073" opacity="0.5"/>`;
  s += `<ellipse cx="${gx + gw - 120}" cy="${gy + gh - 520}" rx="360" ry="300" fill="#b5d38f" opacity="0.5"/>`;
  // lake + river
  s += `<ellipse cx="${gx + gw * 0.68}" cy="${gy + 430}" rx="230" ry="130" fill="#a9d3e8"/><ellipse cx="${gx + gw * 0.68}" cy="${gy + 430}" rx="230" ry="130" fill="none" stroke="#8ec3dd" stroke-width="6"/>`;
  s += `<path d="M ${gx + gw * 0.5} ${gy + 560} C ${gx + gw * 0.42} ${gy + 780}, ${gx + gw * 0.6} ${gy + 980}, ${gx + gw * 0.46} ${gy + 1240}" stroke="#a9d3e8" stroke-width="54" fill="none" stroke-linecap="round"/>`;
  // path
  s += `<path d="M ${gx + gw / 2} ${gy + gh} C ${gx + gw / 2 - 40} ${gy + gh - 380}, ${gx + gw / 2 + 60} ${gy + 900}, ${gx + gw / 2} ${gy + 560}" stroke="#e9dfc7" stroke-width="58" fill="none" stroke-linecap="round"/>`;
  // trees
  const trees = [[90, 190], [gw - 120, 150], [140, 980], [gw - 90, 780], [70, 1420], [gw - 150, 1300], [gw / 2 - 40, 1520]];
  trees.forEach(([tx, ty]) => { const X = gx + tx, Y = gy + ty; s += `<circle cx="${X}" cy="${Y + 20}" r="42" fill="#6f9e55"/><circle cx="${X}" cy="${Y}" r="40" fill="#7fae63"/><circle cx="${X - 22}" cy="${Y + 6}" r="30" fill="#8cbb6f"/>`; });
  // pins
  const pin = (px, py, label, col = BRAND) =>
    `<g><circle cx="${px}" cy="${py}" r="34" fill="${col}" stroke="#fff" stroke-width="6"/>` +
    `<path d="M ${px - 14} ${py + 26} L ${px + 14} ${py + 26} L ${px} ${py + 52} Z" fill="${col}"/>` +
    t(px, py + 12, label, { size: 34, w: 800, fill: '#fff', anchor: 'middle' }) + `</g>`;
  s += pin(gx + gw * 0.34, gy + 640, '1') + pin(gx + gw * 0.66, gy + 430, '2') + pin(gx + gw * 0.5, gy + 1080, '3') + pin(gx + gw * 0.3, gy + 1300, '4');
  // "you are here"
  const mx = gx + gw * 0.52, my = gy + 1520;
  s += `<circle cx="${mx}" cy="${my}" r="52" fill="#1a73e8" opacity="0.18"/><circle cx="${mx}" cy="${my}" r="22" fill="#1a73e8" stroke="#fff" stroke-width="7"/>`;
  s += `</g>`;
  // overlays: offline chip + search bar
  s += rr(SX + 30, SY + 40, 300, 64, 32, 'rgba(15,15,15,0.9)');
  s += `<circle cx="${SX + 68}" cy="${SY + 72}" r="10" fill="#5ad07a"/>` + t(SX + 92, SY + 82, 'Offline · synced 9:02', { size: 25, w: 700, fill: '#eafaef' });
  s += rr(SX + SW - 96, SY + 40, 64, 64, 20, '#fff');
  // bottom pills
  const py = SY + SH - 96;
  s += rr(SX + 30, py, 200, 66, 33, BRAND) + t(SX + 130, py + 43, 'Shows', { size: 26, w: 800, fill: '#fff', anchor: 'middle' });
  s += rr(SX + 246, py, 250, 66, 33, '#fff') + t(SX + 371, py + 43, 'Restaurants', { size: 26, w: 700, fill: INK, anchor: 'middle' });
  s += rr(SX + 512, py, 220, 66, 33, '#fff') + t(SX + 622, py + 43, 'Facilities', { size: 26, w: 700, fill: INK, anchor: 'middle' });
  return s;
}

// ---- screen 3: live schedule ----
function screenSchedule() {
  let s = statusBar() + header('Show Times', 'Live · updates the moment they change');
  const rows = [
    ['The Lost Feather', '11:00', 'On time', '#2e8b57'],
    ['Legend of the Wear', '12:30', 'On time', '#2e8b57'],
    ['Land of the Vikings', '14:15', 'Delayed 15m', '#d98a00'],
    ['Victorian Imaginariums', '16:00', 'On time', '#2e8b57'],
    ['Kynren — Epic Tale', '21:30', 'Selling fast', BRAND],
  ];
  let ry = SY + 240;
  rows.forEach(([name, time, status, col]) => {
    s += rr(SX + 30, ry, SW - 60, 150, 24, '#fff', `stroke="${LINE}" stroke-width="2"`);
    s += rr(SX + 30, ry, 10, 150, 5, col);
    s += t(SX + 64, ry + 66, name, { size: 36, w: 800, fill: INK });
    s += t(SX + 64, ry + 112, 'The Storied Lands', { size: 25, w: 500, fill: MUTED });
    s += t(SX + SW - 64, ry + 64, time, { size: 42, w: 800, fill: INK, anchor: 'end' });
    s += chip(SX + SW - 64 - (30 + status.length * 14), ry + 88, status, { fill: col, tc: '#fff' });
    ry += 174;
  });
  return s;
}

// ---- screen 4: digital ticket ----
function screenTicket() {
  let s = `<clipPath id="sc4"><rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="4"/></clipPath><g clip-path="url(#sc4)">`;
  s += `<defs><linearGradient id="tbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${PLUM0}"/><stop offset="1" stop-color="${PLUM2}"/></linearGradient></defs>`;
  s += rr(SX, SY, SW, SH, 0, 'url(#tbg)');
  s += statusBar().replace(new RegExp(INK, 'g'), '#f4efe6');
  s += t(SX + 34, SY + 150, 'Your Ticket', { size: 46, w: 800, fill: '#fff' });
  s += t(SX + 34, SY + 194, 'Works offline — no signal needed', { size: 27, w: 500, fill: GOLD });
  // ticket card
  const cy = SY + 250, cw = SW - 60, ch = 1120, cx = SX + 30;
  s += rr(cx, cy, cw, ch, 34, '#fdfbf7');
  s += rr(cx, cy, cw, 150, 34, BRAND) + rr(cx, cy + 90, cw, 60, 0, BRAND);
  s += t(cx + cw / 2, cy + 96, 'KYNREN — THE STORIED LANDS', { size: 30, w: 800, fill: '#fff', anchor: 'middle', ls: 1 });
  s += t(cx + cw / 2, cy + 236, 'Advance Saver · Adult', { size: 40, w: 800, fill: INK, anchor: 'middle' });
  s += t(cx + cw / 2, cy + 288, 'Saturday 18 July 2026 · Party of 2', { size: 28, w: 500, fill: MUTED, anchor: 'middle' });
  s += qr(cx + (cw - 560) / 2, cy + 340, 560);
  // perforation + stub
  s += `<line x1="${cx + 40}" y1="${cy + 992}" x2="${cx + cw - 40}" y2="${cy + 992}" stroke="${LINE}" stroke-width="4" stroke-dasharray="14 12"/>`;
  s += t(cx + cw / 2, cy + 1064, 'KYN-2026-4815-STL', { size: 34, w: 800, fill: BRAND_D, anchor: 'middle', ls: 3 });
  s += `</g>`;
  return s;
}

// ---- screen 5: click & collect ----
function screenFood() {
  let s = statusBar() + header('Order Ahead', 'Click & Collect · skip the queue');
  const items = [
    ['Wear Valley Burger', 'Aged beef, smoked cheddar', '£11.50'],
    ['Viking Feast Box', 'Slow-roast pork, flatbread', '£13.00'],
    ['Storyteller’s Pie', 'Steak & ale, buttered mash', '£12.50'],
    ['Meadow Garden Salad', 'Seasonal leaves, honey dressing', '£8.00'],
  ];
  let ry = SY + 240;
  items.forEach(([name, meta, price]) => {
    s += rr(SX + 30, ry, SW - 60, 150, 24, '#fff', `stroke="${LINE}" stroke-width="2"`);
    s += rr(SX + 48, ry + 25, 100, 100, 20, '#efe7d6');
    s += t(SX + 172, ry + 66, name, { size: 35, w: 800, fill: INK });
    s += t(SX + 172, ry + 112, meta, { size: 25, w: 500, fill: MUTED });
    s += t(SX + SW - 56, ry + 92, price, { size: 38, w: 800, fill: BRAND_D, anchor: 'end' });
    ry += 174;
  });
  // ready banner
  const by = SY + SH - 200;
  s += rr(SX + 30, by, SW - 60, 150, 28, '#123d24');
  s += `<circle cx="${SX + 90}" cy="${by + 75}" r="26" fill="#5ad07a"/>`;
  s += t(SX + 132, by + 66, 'Order #204 · Ready for pickup', { size: 33, w: 800, fill: '#eafaef' });
  s += t(SX + 132, by + 108, 'The Longhouse Kitchen · collect anytime', { size: 25, w: 500, fill: '#bfe6cd' });
  return s;
}

const SCREENS = [
  { file: '01-planner', title: ['Your whole day,', 'planned to the minute'], sub: 'A smart, clash-free route through every show', body: screenPlanner },
  { file: '02-offline-map', title: ['Works when the', 'Wi-Fi doesn’t'], sub: 'Offline map, schedule & tickets — zero signal needed', body: screenMap },
  { file: '03-live-times', title: ['Live show times,', 'instant alerts'], sub: 'Delays and cancellations reach you the moment they happen', body: screenSchedule },
  { file: '04-ticket', title: ['Your tickets, always', 'in your pocket'], sub: 'Scannable QR that works fully offline', body: screenTicket },
  { file: '05-order-ahead', title: ['Skip the queue —', 'order ahead'], sub: 'Click & Collect food, ready when you are', body: screenFood },
];

function poster(sc) {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${PLUM0}"/><stop offset="0.55" stop-color="${PLUM1}"/><stop offset="1" stop-color="${PLUM2}"/></linearGradient>`;
  svg += `<radialGradient id="halo" cx="50%" cy="16%" r="42%"><stop offset="0" stop-color="${GOLD}" stop-opacity="0.20"/><stop offset="1" stop-color="${GOLD}" stop-opacity="0"/></radialGradient></defs>`;
  svg += rr(0, 0, W, H, 0, 'url(#bg)') + rr(0, 0, W, H, 0, 'url(#halo)');
  // headline
  sc.title.forEach((line, i) => { svg += t(W / 2, 240 + i * 92, line, { size: 76, w: 800, fill: '#f7f3ea', anchor: 'middle' }); });
  svg += rr(W / 2 - 60, 470, 120, 5, 3, GOLD_D);
  svg += t(W / 2, 552, sc.sub, { size: 34, w: 500, fill: GOLD, anchor: 'middle' });
  // device: shadow, frame, screen
  svg += `<rect x="${PX + 14}" y="${PY + 26}" width="${PW}" height="${PH}" rx="76" fill="#000" opacity="0.35"/>`;
  svg += rr(PX, PY, PW, PH, 76, '#0c0c10');
  svg += rr(SX, SY, SW, SH, 58, PAPER);
  // notch
  svg += rr(W / 2 - 96, SY + 14, 192, 34, 17, '#0c0c10');
  svg += `<clipPath id="screenClip"><rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="58"/></clipPath><g clip-path="url(#screenClip)">`;
  svg += sc.body();
  svg += `</g>`;
  // footer wordmark-ish
  svg += t(W / 2, H - 70, 'KYNREN — THE STORIED LANDS', { size: 30, w: 800, fill: GOLD, anchor: 'middle', ls: 4, op: 0.9 });
  svg += `</svg>`;
  return svg;
}

for (const sc of SCREENS) {
  const svg = poster(sc);
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W }, font: { loadSystemFonts: true } }).render().asPng();
  const p = join(OUT, `${sc.file}.png`);
  writeFileSync(p, png);
  console.log('wrote', p, `${(png.length / 1024).toFixed(0)}kb`);
}
console.log('done →', OUT);
