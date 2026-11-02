/**
 * Where the map picture really is on the ground.
 *
 * Places on the map are stored as positions on the picture (turned into latitude and longitude over an assumed box), so a
 * guest's real GPS fix only lands in the right spot when the picture really covers that box. This ties the picture to the
 * ground instead: staff mark three or more landmarks on the picture and give each one's real coordinates, and the fit
 * below finds how the picture is placed, turned and stretched. The app then turns a GPS fix into a spot on the picture
 * (and a place on the picture into a real spot, for distances) through it.
 *
 * Positions on the picture are fractions: u across (0 left, 1 right) and v down (0 top, 1 bottom). The ground is worked
 * in metres east (x) and north (y) of a point near the landmarks.
 */

export interface GeoPoint {
  u: number;
  v: number;
  lat: number;
  lng: number;
  label?: string;
}

export interface GeoCalibration {
  v: 1;
  points: GeoPoint[];
  /** The point the metres are measured from. */
  origin: { lat: number; lng: number };
  /** x = m[0]*u + m[1]*v + m[2];  y = m[3]*u + m[4]*v + m[5] (metres east and north of the origin). */
  m: [number, number, number, number, number, number];
  /** How far each landmark's fitted position is from where it was said to be, in metres. */
  errors: number[];
  rmsMetres: number;
  maxMetres: number;
  /** Ground covered by the picture, across and down, in metres. */
  metresAcross: number;
  metresDown: number;
}

const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LNG = 111320;

export const MIN_GEO_POINTS = 3;
export const MAX_GEO_POINTS = 12;

const toMetres = (lat: number, lng: number, o: { lat: number; lng: number }) => ({
  x: (lng - o.lng) * M_PER_DEG_LNG * Math.cos((o.lat * Math.PI) / 180),
  y: (lat - o.lat) * M_PER_DEG_LAT,
});

const fromMetres = (x: number, y: number, o: { lat: number; lng: number }) => ({
  lat: o.lat + y / M_PER_DEG_LAT,
  lng: o.lng + x / (M_PER_DEG_LNG * Math.cos((o.lat * Math.PI) / 180)),
});

/** Solves the 3x3 system A·s = b by Cramer's rule; null when the points are in a line (no single answer). */
function solve3(A: number[][], b: number[]): [number, number, number] | null {
  const det = (m: number[][]) =>
    m[0]![0]! * (m[1]![1]! * m[2]![2]! - m[1]![2]! * m[2]![1]!) -
    m[0]![1]! * (m[1]![0]! * m[2]![2]! - m[1]![2]! * m[2]![0]!) +
    m[0]![2]! * (m[1]![0]! * m[2]![1]! - m[1]![1]! * m[2]![0]!);
  const d = det(A);
  if (Math.abs(d) < 1e-9) return null;
  const col = (k: number) => A.map((row, i) => row.map((x, j) => (j === k ? b[i]! : x)));
  return [det(col(0)) / d, det(col(1)) / d, det(col(2)) / d];
}

export type GeoFit = { ok: true; calibration: GeoCalibration } | { ok: false; error: string };

/**
 * Fits the picture to the landmarks (least squares, so with more than three the small disagreements are averaged out
 * and reported as each landmark's error). Says in words what is wrong when it cannot.
 */
export function fitGeoCalibration(input: GeoPoint[]): GeoFit {
  if (input.length < MIN_GEO_POINTS) return { ok: false, error: `Mark at least ${MIN_GEO_POINTS} landmarks.` };
  if (input.length > MAX_GEO_POINTS) return { ok: false, error: `Use at most ${MAX_GEO_POINTS} landmarks.` };
  const points: GeoPoint[] = [];
  for (const p of input) {
    const ok = [p.u, p.v, p.lat, p.lng].every((n) => typeof n === 'number' && Number.isFinite(n));
    if (!ok || p.u < 0 || p.u > 1 || p.v < 0 || p.v > 1) return { ok: false, error: 'A landmark is missing its place on the picture.' };
    if (Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180) return { ok: false, error: 'A latitude must be within 90 and a longitude within 180.' };
    points.push({ u: p.u, v: p.v, lat: p.lat, lng: p.lng, ...(p.label ? { label: String(p.label).slice(0, 60) } : {}) });
  }

  const origin = { lat: points.reduce((s, p) => s + p.lat, 0) / points.length, lng: points.reduce((s, p) => s + p.lng, 0) / points.length };
  const ground = points.map((p) => toMetres(p.lat, p.lng, origin));

  // normal equations for [u v 1] -> x and -> y
  const A = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const bx = [0, 0, 0];
  const by = [0, 0, 0];
  points.forEach((p, i) => {
    const row = [p.u, p.v, 1];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) A[r]![c]! += row[r]! * row[c]!;
      bx[r]! += row[r]! * ground[i]!.x;
      by[r]! += row[r]! * ground[i]!.y;
    }
  });
  const sx = solve3(A, bx);
  const sy = solve3(A, by);
  if (!sx || !sy) return { ok: false, error: 'The landmarks are in a straight line, or on top of each other. Spread them out across the picture.' };

  const m: GeoCalibration['m'] = [sx[0], sx[1], sx[2], sy[0], sy[1], sy[2]];
  const metresAcross = Math.hypot(m[0], m[3]);
  const metresDown = Math.hypot(m[1], m[4]);
  if (metresAcross < 50 || metresAcross > 10000 || metresDown < 50 || metresDown > 10000) {
    return {
      ok: false,
      error: `These coordinates make the picture ${Math.round(metresAcross)} m across and ${Math.round(metresDown)} m down, which cannot be right. Check each one is latitude then longitude, and that each landmark is where you marked it.`,
    };
  }
  // a flipped picture (north at the bottom, say) is not a map of this ground
  if (m[0] * m[4] - m[1] * m[3] >= 0) {
    return { ok: false, error: 'The landmarks put the picture back to front. Check which landmark is which.' };
  }

  const errors = points.map((p, i) => {
    const x = m[0] * p.u + m[1] * p.v + m[2];
    const y = m[3] * p.u + m[4] * p.v + m[5];
    return Math.hypot(x - ground[i]!.x, y - ground[i]!.y);
  });
  const rmsMetres = Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length);
  return {
    ok: true,
    calibration: {
      v: 1,
      points,
      origin,
      m,
      errors: errors.map(round1),
      rmsMetres: round1(rmsMetres),
      maxMetres: round1(Math.max(...errors)),
      metresAcross: Math.round(metresAcross),
      metresDown: Math.round(metresDown),
    },
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The real position of a spot on the picture. */
export function groundOfPicture(c: GeoCalibration, u: number, v: number): { lat: number; lng: number } {
  return fromMetres(c.m[0] * u + c.m[1] * v + c.m[2], c.m[3] * u + c.m[4] * v + c.m[5], c.origin);
}

/** The spot on the picture for a real position (outside 0 to 1 when it is off the picture). */
export function pictureOfGround(c: GeoCalibration, lat: number, lng: number): { u: number; v: number } {
  const { x, y } = toMetres(lat, lng, c.origin);
  const det = c.m[0] * c.m[4] - c.m[1] * c.m[3];
  const px = x - c.m[2];
  const py = y - c.m[5];
  return { u: (c.m[4] * px - c.m[1] * py) / det, v: (c.m[0] * py - c.m[3] * px) / det };
}

/** Reads a stored calibration, re-fitting from its landmarks so a hand-edited or stale record can never put the app wrong. */
export function parseGeoCalibration(raw: unknown): GeoCalibration | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { v?: unknown; points?: unknown };
  if (r.v !== 1 || !Array.isArray(r.points)) return null;
  const fit = fitGeoCalibration(r.points as GeoPoint[]);
  return fit.ok ? fit.calibration : null;
}
