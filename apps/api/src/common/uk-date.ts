/**
 * Show/session/booking dates in this codebase are stored as the admin's UK
 * wall-clock digits wearing a UTC label (`${day}T${HH:MM}:00.000Z`), not real
 * UTC instants. "Today" therefore has to be the current calendar date in the
 * UK (Europe/London), which differs from `new Date().toISOString().slice(0, 10)`
 * (the UTC calendar date) for roughly the first hour of every day while
 * British Summer Time is in effect — e.g. at 00:30 BST it's already
 * "tomorrow" locally but still "today" in UTC, so a plain UTC slice looks up
 * the wrong day's sessions/bookings until 01:00 UTC.
 */
export function ukTodayStr(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
