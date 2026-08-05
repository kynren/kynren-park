export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
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
