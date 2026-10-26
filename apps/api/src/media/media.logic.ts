import { createHash } from 'node:crypto';

/** The kinds of file the park hosts: pictures and short clips. Anything else stays where it is. */
const ALLOWED_MIME = /^(image\/(jpeg|png|gif|webp|avif|svg\+xml)|video\/(mp4|webm|quicktime))$/;

/** The most one file may be (the request body limit is the real ceiling; this keeps a stray huge value out of the table). */
export const MAX_MEDIA_BYTES = 24 * 1024 * 1024;

export interface ParsedDataUrl {
  mime: string;
  bytes: Buffer;
}

/** The file inside a `data:<type>;base64,<…>` URL, or null when it is not one of the kinds the park hosts. */
export function parseDataUrl(value: string): ParsedDataUrl | null {
  const m = /^data:([a-z]+\/[a-z0-9.+-]+)(?:;[a-z0-9=.+-]+)*;base64,/i.exec(value);
  if (!m) return null;
  const mime = m[1]!.toLowerCase();
  if (!ALLOWED_MIME.test(mime)) return null;
  const bytes = Buffer.from(value.slice(m[0].length).replace(/\s/g, ''), 'base64');
  if (bytes.length === 0 || bytes.length > MAX_MEDIA_BYTES) return null;
  return { mime, bytes };
}

/** The id a file is stored and served under: its SHA-256, so identical files share one copy and a URL never changes. */
export const mediaId = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export const MEDIA_ID = /^[a-f0-9]{64}$/;

/** What a stored file is called in a URL, given where the API is reached. */
export const mediaUrl = (base: string, id: string) => `${base.replace(/\/+$/, '')}/api/media/${id}`;

/**
 * Walks any value (a request body, a JSON column) and swaps every embedded picture for the URL [host] returns for it.
 * Returns a copy only where something changed; the second value says whether anything did.
 */
export async function hostEmbedded(value: unknown, host: (file: ParsedDataUrl) => Promise<string>): Promise<[unknown, boolean]> {
  if (typeof value === 'string') {
    if (!value.startsWith('data:')) return [value, false];
    const file = parseDataUrl(value);
    return file ? [await host(file), true] : [value, false];
  }
  if (Array.isArray(value)) {
    let changed = false;
    const out: unknown[] = [];
    for (const item of value) {
      const [v, c] = await hostEmbedded(item, host);
      out.push(v);
      changed ||= c;
    }
    return [changed ? out : value, changed];
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, item] of Object.entries(value)) {
      const [v, c] = await hostEmbedded(item, host);
      out[k] = v;
      changed ||= c;
    }
    return [changed ? out : value, changed];
  }
  return [value, false];
}

/** The byte range a `Range: bytes=a-b` header asks for, or null when absent or not satisfiable as a single range. */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header ?? '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number, end: number;
  if (m[1] === '') {
    const n = Number(m[2]); // the last n bytes
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start <= end && start < size ? { start, end } : null;
}
