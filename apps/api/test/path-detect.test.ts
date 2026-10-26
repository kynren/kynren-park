import { test } from 'node:test';
import assert from 'node:assert/strict';
// The compiled shared package: `npm run build:packages` first.
import { detectPaths, learnSeeds, parseWalkGrid, unpackGrid } from '@kynren/shared';

const W = 400, H = 240;
const GRASS = [60, 110, 50], SAND = [214, 190, 150], CLOUD = [244, 244, 246];

// A park in miniature: grass, a sandy track across and another down, a cloud, and a stray bit of sand.
function park() {
  const data = new Uint8ClampedArray(W * H * 4);
  const paint = (x0: number, y0: number, x1: number, y1: number, c: number[]) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255; }
  };
  paint(0, 0, W, H, GRASS);
  paint(20, 100, 380, 126, SAND); // across
  paint(190, 30, 216, 200, SAND); // down
  paint(300, 20, 380, 70, CLOUD); // a cloud
  paint(40, 30, 44, 34, SAND); // a speck that is not a path
  return { width: W, height: H, data };
}

// the places standing on the paths, as fractions of the picture
const onPaths: [number, number][] = [[0.1, 0.5], [0.3, 0.5], [0.5, 0.55], [0.8, 0.5], [0.5, 0.2], [0.5, 0.8]];

const cellAt = (cells: Uint8Array, gw: number, gh: number, fx: number, fy: number) => cells[Math.floor(fy * gh) * gw + Math.floor(fx * gw)];

test('the path colour is learnt from the places standing on it, and grass and sky are ignored', () => {
  const seeds = learnSeeds(park(), [...onPaths, [0.05, 0.1], [0.9, 0.2]]); // two more on grass and on the cloud
  assert.ok(seeds.length >= 1);
  for (const [r, g, b] of seeds) assert.ok(Math.abs(r - SAND[0]) < 12 && Math.abs(g - SAND[1]) < 12 && Math.abs(b - SAND[2]) < 12, `not sand: ${r},${g},${b}`);
});

test('the walkable cells cover the tracks, and not the grass, the cloud or a stray speck', () => {
  const { grid } = detectPaths(park(), { points: onPaths, gridWidth: 100 });
  assert.equal(grid.w, 100);
  assert.equal(grid.h, 60);
  const cells = unpackGrid(grid);
  assert.equal(cellAt(cells, grid.w, grid.h, 0.2, 0.5), 1, 'along the across track');
  assert.equal(cellAt(cells, grid.w, grid.h, 0.9, 0.5), 1, 'the far end of the across track');
  assert.equal(cellAt(cells, grid.w, grid.h, 0.5, 0.3), 1, 'down the other track');
  assert.equal(cellAt(cells, grid.w, grid.h, 0.2, 0.2), 0, 'grass');
  assert.equal(cellAt(cells, grid.w, grid.h, 0.85, 0.2), 0, 'the cloud');
  assert.equal(cellAt(cells, grid.w, grid.h, 0.105, 0.135), 0, 'a speck of sand too small to be a path');
});

test('without any places to learn from it still finds sandy tracks', () => {
  const { grid, seeds } = detectPaths(park(), { gridWidth: 100 });
  assert.ok(seeds.length >= 1);
  assert.equal(cellAt(unpackGrid(grid), grid.w, grid.h, 0.2, 0.5), 1);
});

test('a stricter match finds less, a looser one more', () => {
  const count = (tolerance: number) => unpackGrid(detectPaths(park(), { points: onPaths, tolerance, gridWidth: 100 }).grid).reduce((n, v) => n + v, 0);
  assert.ok(count(8) <= count(20));
  assert.ok(count(20) <= count(34));
});

test('a grid survives being stored and read back, and a malformed one is refused', () => {
  const { grid } = detectPaths(park(), { points: onPaths, gridWidth: 64 });
  const back = parseWalkGrid(JSON.parse(JSON.stringify(grid)));
  assert.deepEqual(back, grid);
  assert.equal(parseWalkGrid(null), null);
  assert.equal(parseWalkGrid({ ...grid, v: 2 }), null);
  assert.equal(parseWalkGrid({ ...grid, bits: grid.bits.slice(4) }), null, 'wrong amount of data for its size');
  assert.equal(parseWalkGrid({ ...grid, bits: '!!!!' }), null);
  assert.equal(parseWalkGrid({ ...grid, w: 100000 }), null);
});
