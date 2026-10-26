// Finds the walkways on an illustrated park map so the app can route guests along them.
//
// The map is a picture, so a "path" is a colour: the sandy track, the grey tarmac. The colour is learnt from the places
// the admin put on the map (an entrance, a picnic area and a restroom all stand on a path or a plaza), or given by hand.
// Everything that looks like that colour is cleaned up (gaps closed, specks and cloud fringes dropped) and stored as a
// coarse grid of walkable cells. The app finds routes across that grid, which suits plazas and wide tracks as well as
// narrow footpaths. Pure functions over pixels, with no browser or Node dependency, so the admin can run it on a canvas
// and the tests can run it on a decoded file.

export type RGB = [number, number, number];

/** An RGBA picture, row by row. The detector is tuned for about 1000 px across; callers shrink bigger maps first. */
export interface PixelImage {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

/** The walkable area: [w] by [h] cells covering the whole map picture, one bit per cell (1 = walkable), row by row,
 *  most significant bit first, as base64. A cell is a fraction of the picture, so the grid lines up with the map
 *  rectangle the places are positioned on, whatever size the picture is shown at. */
export interface WalkGrid {
  v: 1;
  w: number;
  h: number;
  bits: string;
}

export interface DetectOptions {
  /** Path colours to look for. When absent they are learnt from [points]. */
  seeds?: RGB[];
  /** Places known to stand on a path or plaza, as fractions of the picture. */
  points?: [number, number][];
  /** How far from a path colour a pixel may be and still count (CIE Lab distance). */
  tolerance?: number;
  /** How many cells across the stored grid is. */
  gridWidth?: number;
}

export interface DetectResult {
  grid: WalkGrid;
  seeds: RGB[];
  /** What counted as path at the working resolution (for tests and previews). */
  mask: Uint8Array;
  width: number;
  height: number;
}

/** Used when a map has no places to learn from: a sandy track and grey tarmac. */
export const defaultSeeds: RGB[] = [
  [214, 190, 150],
  [128, 124, 118],
];

const GAMMA = (() => {
  const t = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    t[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return t;
})();

type Lab = [number, number, number];

function toLab(r: number, g: number, b: number): Lab {
  const lr = GAMMA[r], lg = GAMMA[g], lb = GAMMA[b];
  const x = (0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / 0.95047;
  const y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const z = (0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const dE = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Like dE, but twice as strict about green against red: a hazy cloud edge or a shaded lawn blends toward green, and
 *  must not pass for sand just because it is the same lightness. */
const dPath = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], 2 * (a[1] - b[1]), a[2] - b[2]);

function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  return s[s.length >> 1];
}

/** Learns the path colours from places standing on paths: the colours that several of them share, ignoring grass and sky. */
export function learnSeeds(img: PixelImage, points: [number, number][]): RGB[] {
  const { width: w, height: h, data } = img;
  const clusters: { lab: Lab; rgb: RGB; n: number; members: RGB[] }[] = [];
  for (const [nx, ny] of points) {
    const cx = Math.round(nx * (w - 1)), cy = Math.round(ny * (h - 1));
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    const rs: number[] = [], gs: number[] = [], bs: number[] = [];
    for (let y = Math.max(0, cy - 2); y <= Math.min(h - 1, cy + 2); y++) {
      for (let x = Math.max(0, cx - 2); x <= Math.min(w - 1, cx + 2); x++) {
        const i = (y * w + x) * 4;
        rs.push(data[i]);
        gs.push(data[i + 1]);
        bs.push(data[i + 2]);
      }
    }
    const rgb: RGB = [median(rs), median(gs), median(bs)];
    const lab = toLab(...rgb);
    const chroma = Math.hypot(lab[1], lab[2]);
    const greenish = rgb[1] > rgb[0] + 6 && rgb[1] >= rgb[2];
    if (greenish || lab[0] < 40 || (lab[0] > 88 && chroma < 12)) continue; // grass, shadow, cloud, roof: not a path
    const hit = clusters.find((c) => dE(c.lab, lab) < 16);
    if (hit) {
      hit.rgb = [0, 1, 2].map((k) => Math.round((hit.rgb[k] * hit.n + rgb[k]) / (hit.n + 1))) as RGB;
      hit.lab = toLab(...hit.rgb);
      hit.members.push(rgb);
      hit.n++;
    } else {
      clusters.push({ lab, rgb, n: 1, members: [rgb] });
    }
  }
  clusters.sort((a, b) => b.n - a.n);
  if (!clusters.length) return [];
  const top = clusters[0].n;
  // the colours themselves, not their average: two car parks of different greys must both count, a grey between them must not
  const out: RGB[] = [];
  for (const c of clusters.filter((c, i) => i < 4 && (c.n >= 2 || i === 0) && c.n >= top * 0.3)) {
    for (const rgb of c.members) if (!out.some((o) => dE(toLab(...o), toLab(...rgb)) < 5)) out.push(rgb);
  }
  return out.slice(0, 12);
}

// ---------------------------------------------------------------- mask clean-up

/** A 3x3 dilate (grow) or erode (shrink) of a 0/1 mask, [times] over. */
function morph(src: Uint8Array, w: number, h: number, grow: boolean, times: number): Uint8Array {
  let cur = src;
  for (let t = 0; t < times; t++) {
    const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = x > 0 ? cur[y * w + x - 1] : 0, m = cur[y * w + x], r = x < w - 1 ? cur[y * w + x + 1] : 0;
        tmp[y * w + x] = grow ? l | m | r : l & m & r;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = y > 0 ? tmp[(y - 1) * w + x] : 0, m = tmp[y * w + x], d = y < h - 1 ? tmp[(y + 1) * w + x] : 0;
        out[y * w + x] = grow ? u | m | d : u & m & d;
      }
    }
    cur = out;
  }
  return cur;
}

/** Calls [visit] with every 4-connected piece of the cells equal to [value], and whether it touches the picture's edge. */
function eachPiece(mask: Uint8Array, w: number, h: number, value: number, visit: (cells: number[], touchesEdge: boolean) => void) {
  const seen = new Uint8Array(w * h), stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (mask[s] !== value || seen[s]) continue;
    const cells: number[] = [];
    let edge = false;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      cells.push(p);
      const x = p % w, y = (p / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (x > 0 && mask[p - 1] === value && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
      if (x < w - 1 && mask[p + 1] === value && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
      if (y > 0 && mask[p - w] === value && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
      if (y < h - 1 && mask[p + w] === value && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
    }
    visit(cells, edge);
  }
}

/** Drops pieces of mask smaller than [minArea] pixels. */
function dropSmall(mask: Uint8Array, w: number, h: number, minArea: number): Uint8Array {
  const out = new Uint8Array(w * h);
  eachPiece(mask, w, h, 1, (cells) => {
    if (cells.length >= minArea) for (const p of cells) out[p] = 1;
  });
  return out;
}

/** Fills holes in the mask no bigger than [maxArea] pixels (a car on a track, a lamp post, a bench). */
function fillHoles(mask: Uint8Array, w: number, h: number, maxArea: number): Uint8Array {
  const out = Uint8Array.from(mask);
  eachPiece(mask, w, h, 0, (cells, edge) => {
    if (!edge && cells.length <= maxArea) for (const p of cells) out[p] = 1;
  });
  return out;
}

// ---------------------------------------------------------------- the stored grid

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}

function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let acc = 0, bits = 0, o = 0;
  for (const ch of clean) {
    acc = ((acc << 6) | B64.indexOf(ch)) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 255;
    }
  }
  return out;
}

/** Shrinks a full-size mask to the stored grid: a cell is walkable when enough of the pixels under it are. */
function toGrid(mask: Uint8Array, w: number, h: number, gw: number): WalkGrid {
  const gh = Math.max(1, Math.round((gw * h) / w));
  const cells = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    const y0 = Math.floor((gy * h) / gh), y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * h) / gh));
    for (let gx = 0; gx < gw; gx++) {
      const x0 = Math.floor((gx * w) / gw), x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * w) / gw));
      let on = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) on += mask[y * w + x];
      cells[gy * gw + gx] = on * 100 >= (x1 - x0) * (y1 - y0) * 35 ? 1 : 0;
    }
  }
  const bytes = new Uint8Array(Math.ceil((gw * gh) / 8));
  for (let i = 0; i < cells.length; i++) if (cells[i]) bytes[i >> 3] |= 0x80 >> (i & 7);
  return { v: 1, w: gw, h: gh, bits: toBase64(bytes) };
}

/** The grid's cells, one byte each (0 or 1), row by row. */
export function unpackGrid(grid: WalkGrid): Uint8Array {
  const bytes = fromBase64(grid.bits), out = new Uint8Array(grid.w * grid.h);
  for (let i = 0; i < out.length; i++) out[i] = (bytes[i >> 3] >> (7 - (i & 7))) & 1;
  return out;
}

/** Finds the walkways on [img] and returns them as a grid of walkable cells. */
export function detectPaths(img: PixelImage, opts: DetectOptions = {}): DetectResult {
  const { width: w, height: h, data } = img;
  const scale = w / 1000;
  const seeds = opts.seeds?.length ? opts.seeds : opts.points?.length ? learnSeeds(img, opts.points) : [];
  const useSeeds = seeds.length ? seeds : defaultSeeds;
  const seedLab = useSeeds.map((s) => toLab(...s));
  const tol = opts.tolerance ?? 20;
  // a greyish seed matches a narrower band than a strongly coloured one, or it would take in half the map
  const seedTol = seedLab.map((s) => tol * Math.min(1, Math.max(0.45, Math.hypot(s[1], s[2]) / 25)));

  let mask: Uint8Array = new Uint8Array(w * h);
  const white = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const lab = toLab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    if (lab[0] > 80 && Math.hypot(lab[1], lab[2]) < 16) white[i] = 1; // cloud, snow, white roofs
    for (let k = 0; k < seedLab.length; k++) {
      if (dPath(lab, seedLab[k]) <= seedTol[k]) { mask[i] = 1; break; }
    }
  }
  // the soft fringe around a cloud blends into path colours: nothing within a few pixels of white counts
  const nearWhite = morph(dropSmall(white, w, h, Math.round(400 * scale * scale)), w, h, true, Math.max(2, Math.round(12 * scale)));
  for (let i = 0; i < w * h; i++) if (nearWhite[i]) mask[i] = 0;

  // close small gaps in the colour, drop specks, fill small holes, then shave thin edges and slivers
  mask = morph(morph(mask, w, h, true, 1), w, h, false, 1);
  mask = fillHoles(mask, w, h, Math.round(60 * scale * scale));
  mask = dropSmall(mask, w, h, Math.round(160 * scale * scale));
  mask = morph(morph(mask, w, h, false, 1), w, h, true, 1);
  mask = dropSmall(mask, w, h, Math.round(120 * scale * scale));

  return { grid: toGrid(mask, w, h, opts.gridWidth ?? 512), seeds: useSeeds, mask, width: w, height: h };
}

/** Checks a grid read from the outside (an upload, a database row) and returns it, or null if it is not one. */
export function parseWalkGrid(raw: unknown): WalkGrid | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as { v?: unknown; w?: unknown; h?: unknown; bits?: unknown };
  if (g.v !== 1 || typeof g.w !== 'number' || typeof g.h !== 'number' || typeof g.bits !== 'string') return null;
  if (!Number.isInteger(g.w) || !Number.isInteger(g.h) || g.w < 16 || g.h < 16 || g.w > 2048 || g.h > 2048) return null;
  const bytes = Math.ceil((g.w * g.h) / 8);
  if (g.bits.length !== 4 * Math.ceil(bytes / 3) || !/^[A-Za-z0-9+/]+={0,2}$/.test(g.bits)) return null;
  return { v: 1, w: g.w, h: g.h, bits: g.bits };
}
