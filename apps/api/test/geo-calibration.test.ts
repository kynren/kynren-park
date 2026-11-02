import { test } from 'node:test';
import assert from 'node:assert/strict';
// The compiled shared package: `npm run build:packages` first.
import { fitGeoCalibration, groundOfPicture, parseGeoCalibration, pictureOfGround, type GeoPoint } from '@kynren/shared';

// A picture 900 m across and 650 m down, turned 12 degrees from north, with its top-left corner at a known spot.
const ORIGIN = { lat: 54.6715, lng: -1.679 };
const ACROSS = 900, DOWN = 650, TURN = (12 * Math.PI) / 180;
const M_LAT = 110540, M_LNG = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

function truth(u: number, v: number): { lat: number; lng: number } {
  const dx = (u - 0.5) * ACROSS, dy = (0.5 - v) * DOWN; // metres east and north of the picture's middle, before turning
  const x = dx * Math.cos(TURN) - dy * Math.sin(TURN);
  const y = dx * Math.sin(TURN) + dy * Math.cos(TURN);
  return { lat: ORIGIN.lat + y / M_LAT, lng: ORIGIN.lng + x / M_LNG };
}
const at = (u: number, v: number, label?: string): GeoPoint => ({ u, v, ...truth(u, v), label });

test('four landmarks on a turned picture are fitted exactly, and its size and turn come out right', () => {
  const fit = fitGeoCalibration([at(0.1, 0.1), at(0.9, 0.15), at(0.85, 0.9), at(0.2, 0.8)]);
  assert.ok(fit.ok);
  const c = fit.calibration;
  assert.ok(c.rmsMetres < 0.5, `rms ${c.rmsMetres}`);
  assert.ok(Math.abs(c.metresAcross - ACROSS) <= 2, `across ${c.metresAcross}`);
  assert.ok(Math.abs(c.metresDown - DOWN) <= 2, `down ${c.metresDown}`);
});

test('a spot on the picture and its real position convert both ways', () => {
  const fit = fitGeoCalibration([at(0.1, 0.1), at(0.9, 0.15), at(0.5, 0.9)]);
  assert.ok(fit.ok);
  for (const [u, v] of [[0.3, 0.4], [0.75, 0.6], [0, 0], [1, 1]] as const) {
    const g = groundOfPicture(fit.calibration, u, v);
    const t = truth(u, v);
    assert.ok(Math.abs(g.lat - t.lat) < 1e-6 && Math.abs(g.lng - t.lng) < 1e-6, `ground of ${u},${v}`);
    const back = pictureOfGround(fit.calibration, g.lat, g.lng);
    assert.ok(Math.abs(back.u - u) < 1e-6 && Math.abs(back.v - v) < 1e-6, `picture of ${u},${v}`);
  }
});

test('a landmark that is out by a few metres shows in its own error and in the overall one', () => {
  const pts = [at(0.1, 0.1), at(0.9, 0.15), at(0.85, 0.9), at(0.2, 0.8)];
  pts[2] = { ...pts[2]!, lat: pts[2]!.lat + 20 / M_LAT }; // 20 m north of where it is
  const fit = fitGeoCalibration(pts);
  assert.ok(fit.ok);
  assert.ok(fit.calibration.maxMetres > 5 && fit.calibration.maxMetres < 25, `max ${fit.calibration.maxMetres}`);
  assert.equal(fit.calibration.errors.length, 4);
  assert.equal(fit.calibration.maxMetres, Math.max(...fit.calibration.errors));
});

test('the park as the app has always assumed it (a north-up box) comes out as that box', () => {
  const b = { minLat: 54.668, maxLat: 54.675, minLng: -1.684, maxLng: -1.674 };
  const corner = (u: number, v: number): GeoPoint => ({ u, v, lat: b.maxLat - v * (b.maxLat - b.minLat), lng: b.minLng + u * (b.maxLng - b.minLng) });
  const fit = fitGeoCalibration([corner(0, 0), corner(1, 0), corner(0, 1), corner(0.5, 0.5)]);
  assert.ok(fit.ok);
  assert.ok(Math.abs(fit.calibration.metresAcross - 0.01 * 111320 * Math.cos(54.6715 * Math.PI / 180)) < 2);
  assert.ok(Math.abs(fit.calibration.metresDown - 0.007 * 110540) < 2);
  assert.ok(fit.calibration.rmsMetres < 0.5);
});

test('too few, in a line, swapped, flipped or impossible landmarks are refused in words', () => {
  const few = fitGeoCalibration([at(0.1, 0.1), at(0.9, 0.9)]);
  assert.ok(!few.ok && /at least 3/.test(few.error));

  const line = fitGeoCalibration([at(0.1, 0.1), at(0.5, 0.5), at(0.9, 0.9)]);
  assert.ok(!line.ok && /straight line/.test(line.error));

  const swapped = fitGeoCalibration([at(0.1, 0.1), at(0.9, 0.15), at(0.5, 0.9)].map((p) => ({ ...p, lat: p.lng, lng: p.lat })));
  assert.ok(!swapped.ok);

  const mirrored = fitGeoCalibration([at(0.1, 0.1), at(0.9, 0.15), at(0.5, 0.9)].map((p) => ({ ...p, u: 1 - p.u })));
  assert.ok(!mirrored.ok && /back to front/.test(mirrored.error));

  const huge = fitGeoCalibration([at(0.1, 0.1), at(0.9, 0.15), at(0.5, 0.9)].map((p) => ({ ...p, lat: ORIGIN.lat + (p.lat - ORIGIN.lat) * 40 })));
  assert.ok(!huge.ok);

  const offPicture = fitGeoCalibration([{ ...at(0.1, 0.1), u: 1.4 }, at(0.9, 0.15), at(0.5, 0.9)]);
  assert.ok(!offPicture.ok);
});

test('a stored calibration is re-fitted from its landmarks when read, and junk reads as none', () => {
  const fit = fitGeoCalibration([at(0.1, 0.1), at(0.9, 0.15), at(0.85, 0.9)]);
  assert.ok(fit.ok);
  const stored = JSON.parse(JSON.stringify({ ...fit.calibration, m: [1, 2, 3, 4, 5, 6], rmsMetres: 0 })); // tampered numbers
  const back = parseGeoCalibration(stored);
  assert.ok(back);
  assert.deepEqual(back.m, fit.calibration.m, 'the fitted numbers come from the landmarks, not from what was stored');
  assert.equal(parseGeoCalibration(null), null);
  assert.equal(parseGeoCalibration({ v: 2, points: [] }), null);
  assert.equal(parseGeoCalibration({ v: 1, points: 'x' }), null);
});
