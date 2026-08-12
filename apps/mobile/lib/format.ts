export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

// Kynren is a single-park, UK-only app: the backend stores show times as the
// admin's UK wall-clock digits with a UTC label (e.g. an admin-entered "10:00"
// is stored as `10:00:00.000Z`, not real UTC) — fmtTime above relies on this by
// reading it back with timeZone:'UTC'. That only stays correct if "now" is
// computed the same way. The UK is on GMT (UTC+0) in winter but BST (UTC+1)
// for the entire show season (opens 18 July) — a raw `Date.now()`/`new Date()`
// is a true UTC instant, so during BST it's an hour ahead of what these
// stored times mean, which throws off every "has this show started/finished
// yet" and "what's today's date" check for the whole season, regardless of
// the visitor's own device timezone. ukNow() re-derives "now" the same way
// the stored times were built, so plain epoch comparisons work correctly.
export function ukNow(): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return new Date(`${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.000Z`);
}

export function ukTodayStr(): string {
  return ukNow().toISOString().slice(0, 10);
}

export function fmtRelative(date: Date | null): string {
  if (!date) return 'never';
  const secs = Math.round((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)} min ago`;
  return `${Math.floor(secs / 3600)} h ago`;
}

export function poundsFromCents(cents: number): string {
  return cents === 0 ? 'Free' : `£${(cents / 100).toFixed(2)}`;
}
