/**
 * Which Smeetz to read, and how to behave when it answers badly. Pure, so the decisions that matter - am I about to point a
 * test key at the live host, should this be retried - can be tested without a network.
 */

export type SmeetzEnvironment = 'test' | 'live';
/** Smeetz splits its API across two host families under each environment; both take the same key. */
export type SmeetzHost = 'services' | 'api';

const BASE_URLS: Record<SmeetzHost, Record<SmeetzEnvironment, string>> = {
  services: { test: 'https://services.test.smeetz.com', live: 'https://services-live.smeetz.com' },
  api: { test: 'https://api-test.smeetz.com', live: 'https://api-live.smeetz.com' },
};

/**
 * SMEETZ_ENVIRONMENT says it outright; failing that it is read off SMEETZ_API_URL (the host the rest of the API already uses).
 * With neither, it is the test host: a fresh checkout must not be able to read a live ticketing system by accident.
 */
export function smeetzEnvironment(env: { SMEETZ_ENVIRONMENT?: string; SMEETZ_API_URL?: string }): SmeetzEnvironment {
  const named = (env.SMEETZ_ENVIRONMENT ?? '').trim().toLowerCase();
  if (named === 'live' || named === 'test') return named;
  const url = (env.SMEETZ_API_URL ?? '').toLowerCase();
  return url.includes('live') ? 'live' : 'test';
}

export function baseUrlFor(environment: SmeetzEnvironment, host: SmeetzHost): string {
  return BASE_URLS[host][environment];
}

export type SmeetzFailure =
  | { kind: 'disabled' }
  | { kind: 'unauthorised'; status: number }
  | { kind: 'rateLimited'; status: 429; retryAfterMs: number }
  | { kind: 'notFound'; status: 404 }
  | { kind: 'server'; status: number }
  | { kind: 'network'; message: string }
  | { kind: 'timeout' }
  | { kind: 'badResponse'; message: string };

export function describeFailure(f: SmeetzFailure): string {
  switch (f.kind) {
    case 'disabled':
      return 'Smeetz is not configured';
    case 'unauthorised':
      return 'Smeetz rejected the API key (keys are issued per environment: a live key is refused by the test host and the reverse)';
    case 'rateLimited':
      return 'Smeetz is rate limiting us (250 requests a minute for the whole account)';
    case 'notFound':
      return 'Smeetz has no record of that';
    case 'server':
      return `Smeetz returned an error (${f.status})`;
    case 'network':
      return `Could not reach Smeetz: ${f.message}`;
    case 'timeout':
      return 'Smeetz did not answer in time';
    case 'badResponse':
      return `Smeetz answered with something unexpected: ${f.message}`;
  }
}

/** Retry only what retrying can fix: a rejected key or a missing record will be rejected and missing again. */
export function shouldRetry(f: SmeetzFailure): boolean {
  return f.kind === 'rateLimited' || f.kind === 'timeout' || f.kind === 'network' || f.kind === 'badResponse' || (f.kind === 'server' && f.status >= 500);
}

export function backoffMs(attempt: number, f?: SmeetzFailure): number {
  if (f?.kind === 'rateLimited' && f.retryAfterMs > 0) return Math.min(f.retryAfterMs, 10_000);
  return Math.min(400 * 2 ** attempt, 5_000);
}

/** `Retry-After` is seconds, or an HTTP date. Anything else counts as absent. */
export function parseRetryAfter(header: string | null, now = Date.now()): number {
  if (!header) return 0;
  const seconds = Number(header.trim());
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const at = Date.parse(header);
  return Number.isFinite(at) ? Math.max(0, at - now) : 0;
}

export function failureForStatus(status: number, retryAfter: string | null = null, now = Date.now()): SmeetzFailure | null {
  if (status >= 200 && status < 300) return null;
  if (status === 401 || status === 403) return { kind: 'unauthorised', status };
  if (status === 404) return { kind: 'notFound', status: 404 };
  if (status === 429) return { kind: 'rateLimited', status: 429, retryAfterMs: parseRetryAfter(retryAfter, now) };
  return { kind: 'server', status };
}

/** A date as the UTC calendar day Smeetz expects: a full timestamp makes its order list return nothing at all. */
export function smeetzDate(value: string | Date | undefined | null): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

/**
 * An empty answer to a date-filtered request is normal on a quiet night, and also exactly what Smeetz gives for a filter it
 * cannot read. If the same endpoint's newest unfiltered orders are on or after the filter's day, the empty answer was wrong.
 */
export function filterLooksBroken(startDate: string, newestUnfiltered: (string | undefined)[]): boolean {
  const start = smeetzDate(startDate);
  if (!start) return false;
  return newestUnfiltered.some((created) => {
    const day = smeetzDate(created);
    return day !== undefined && day >= start;
  });
}

/** Smeetz's own order ids are UUIDs; older orders carry a short code instead, which its one-order call does not know. */
export const SMEETZ_ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An order, ticket or voucher that has been cancelled, refunded, voided or has expired. */
export const GONE = /CANCEL|REFUND|VOID|EXPIRE/i;
