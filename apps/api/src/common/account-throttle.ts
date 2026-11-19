/**
 * Rate limits keyed by the account being attacked, not only by the caller's internet address.
 *
 * The app-wide limits count requests per IP address. A VPN or proxy hands out a new address with every connection, so one
 * person can get round "5 sign-in attempts a minute" simply by switching address. Anything that names an account (sign in,
 * register, forgotten password, the email lookup of bookings) is therefore also counted per email address, wherever the
 * request comes from.
 */

/** The account a request is about: its email address in the body, normalised, or null when it names none. */
export function accountKeyOf(req: { body?: unknown } | undefined): string | null {
  const body = req?.body;
  if (!body || typeof body !== 'object') return null;
  const email = (body as Record<string, unknown>).email;
  if (typeof email !== 'string') return null;
  const key = email.trim().toLowerCase();
  // Not a plausible address: let the route's own validation reject it (and the per-IP limit still counts it).
  return key.length >= 3 && key.length <= 254 ? key : null;
}
