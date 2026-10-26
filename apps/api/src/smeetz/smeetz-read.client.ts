import { Injectable, Logger } from '@nestjs/common';
import {
  backoffMs,
  baseUrlFor,
  describeFailure,
  failureForStatus,
  shouldRetry,
  smeetzEnvironment,
  type SmeetzFailure,
  type SmeetzHost,
} from './smeetz-config.js';

export type SmeetzResult<T> = { ok: true; data: T } | { ok: false; failure: SmeetzFailure };

const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;

/**
 * The park's one way to READ Smeetz for the order mirror. GET only, on purpose: nothing here can create, change or cancel a
 * booking, and the absence of a POST helper is the clearest way to keep it that way. (SmeetzService is the older client that
 * can write; the mirror never uses it.) It never throws - callers get a result - and it never logs the key.
 */
@Injectable()
export class SmeetzReadClient {
  private readonly logger = new Logger(SmeetzReadClient.name);

  get configured(): boolean {
    return (process.env.SMEETZ_API_KEY ?? '').length > 0;
  }

  get environment() {
    return smeetzEnvironment(process.env);
  }

  async get<T>(host: SmeetzHost, path: string, query: Record<string, string | number | undefined> = {}): Promise<SmeetzResult<T>> {
    const apiKey = process.env.SMEETZ_API_KEY ?? '';
    if (!apiKey) return { ok: false, failure: { kind: 'disabled' } };

    const url = new URL(path, baseUrlFor(this.environment, host));
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') url.searchParams.set(k, String(v));

    let last: SmeetzFailure = { kind: 'network', message: 'no attempt made' };
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, backoffMs(attempt - 1, last)));
      const result = await this.once<T>(url, apiKey);
      if (result.ok) return result;
      last = result.failure;
      if (!shouldRetry(last)) break;
    }
    this.logger.warn(`Smeetz GET ${path} failed: ${describeFailure(last)}`);
    return { ok: false, failure: last };
  }

  private async once<T>(url: URL, apiKey: string): Promise<SmeetzResult<T>> {
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'x-public-api-key': apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const failure = failureForStatus(res.status, res.headers.get('retry-after'));
      if (failure) return { ok: false, failure };
      try {
        return { ok: true, data: (await res.json()) as T };
      } catch (e) {
        return { ok: false, failure: { kind: 'badResponse', message: (e as Error).message } };
      }
    } catch (e) {
      const err = e as Error;
      if (err.name === 'TimeoutError' || err.name === 'AbortError') return { ok: false, failure: { kind: 'timeout' } };
      return { ok: false, failure: { kind: 'network', message: err.message } };
    }
  }
}
