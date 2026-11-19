/**
 * Whether a position a phone reports can be believed, so a faked location does not count as a guest being in the park.
 *
 * What it can and cannot do: it throws out numbers that are not coordinates and jumps no traveller could make since the
 * last report. It cannot tell a careful fake that moves like a person from a real fix; the phone app also refuses
 * positions Android marks as mock locations.
 */

/** Faster than this between two reports is not a person (about 430 km/h, so a flight between two reports is the only honest case it refuses). */
export const MAX_SPEED_MPS = 120;

export type Fix = { lat: number; lng: number };
export type PreviousFix = Fix & { at: Date };

function metres(a: Fix, b: Fix): number {
  const r = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export function isPlausibleFix(next: Fix, previous: PreviousFix | null, now: Date): boolean {
  const { lat, lng } = next;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  if (lat === 0 && lng === 0) return false; // the "null island" a broken or faked provider reports
  if (!previous) return true;
  const seconds = Math.max(1, (now.getTime() - previous.at.getTime()) / 1000);
  return metres(previous, next) / seconds <= MAX_SPEED_MPS;
}
