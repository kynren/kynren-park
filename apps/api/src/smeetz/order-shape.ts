import { GONE } from './smeetz-config.js';

export function normaliseEmail(raw: unknown): string {
  const text = String(raw ?? '').trim().toLowerCase();
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(text) ? text : '';
}

// ---------------------------------------------------------------- what a guest may see

export interface GuestTicket {
  barcode: string | null;
  /** What the ticket's QR code holds, where Smeetz gave it: the app draws this, and falls back to the barcode without it. */
  qr: string | null;
  status: string | null;
  night: string | null;
  holder: string | null;
}

export interface GuestLine {
  kind: 'TICKET' | 'RETAIL' | 'VOUCHER' | 'MEMBERSHIP';
  name: string;
  priceName: string | null;
  quantity: number;
  tickets: GuestTicket[];
}

export interface GuestOrder {
  reference: string;
  status: string;
  placedAt: string;
  currency: string;
  valueTotal: number;
  liveTickets: number;
  nights: string[];
  lines: GuestLine[];
}

/** What the booking system holds about the person who bought: any of it may be missing. */
export interface GuestBuyer {
  name: string | null;
  phone: string | null;
  address: string | null;
}

/** The rows the mirror keeps for an order and its lines (a subset of the Prisma models). */
export interface MirrorOrderRow {
  reference: string;
  status: string;
  currency: string;
  smeetzCreatedAt: Date;
  lines: {
    kind: string;
    itemName: string;
    priceName: string | null;
    priceValue: number | null;
    quantity: number;
    itemStatus: string | null;
    showDate: Date | null;
    barcode: string | null;
    qrCode: string | null;
    voucherCode: string | null;
    voucherStatus: string | null;
    membershipCode: string | null;
    membershipStatus: string | null;
    guestFirstName: string | null;
    guestLastName: string | null;
  }[];
}

const KINDS = ['TICKET', 'RETAIL', 'VOUCHER', 'MEMBERSHIP'] as const;
const day = (d: Date) => d.toISOString().slice(0, 10);

/** What a guest's own app may see of an order: no buyer contact details, no internal ids, no form answers. */
export function toGuestOrder(order: MirrorOrderRow): GuestOrder {
  // One line per kind, name and price tier, as Smeetz's own order screen groups them.
  const grouped = new Map<string, GuestLine>();
  let total = 0;
  let live = 0;
  const nights = new Map<string, Date>();

  for (const row of order.lines) {
    const kind = (KINDS as readonly string[]).includes(row.kind) ? (row.kind as GuestLine['kind']) : 'TICKET';
    const key = `${kind}|${row.itemName}|${row.priceName ?? ''}`;
    let line = grouped.get(key);
    if (!line) {
      line = { kind, name: row.itemName, priceName: row.priceName, quantity: 0, tickets: [] };
      grouped.set(key, line);
    }
    line.quantity += row.quantity;
    const status = row.itemStatus ?? row.voucherStatus ?? row.membershipStatus;
    line.tickets.push({
      barcode: row.barcode ?? row.voucherCode ?? row.membershipCode,
      qr: row.qrCode ? row.qrCode : null, // '' means Smeetz was asked and has none
      status,
      night: row.showDate ? day(row.showDate) : null,
      holder: [row.guestFirstName, row.guestLastName].filter(Boolean).join(' ') || null,
    });
    if (row.showDate) nights.set(day(row.showDate), row.showDate);
    if (row.priceValue !== null && !(status && GONE.test(status))) total += row.priceValue;
    if (kind === 'TICKET' && !GONE.test(status ?? '')) live += 1;
  }

  return {
    reference: order.reference,
    status: order.status,
    placedAt: order.smeetzCreatedAt.toISOString(),
    currency: order.currency,
    valueTotal: Math.round(total * 100) / 100,
    liveTickets: live,
    nights: [...nights.values()].sort((a, b) => a.getTime() - b.getTime()).map(day),
    lines: [...grouped.values()],
  };
}

// ------------------------------------------------------ Smeetz's order, flattened for the mirror

type Json = Record<string, unknown>;

export type RawSmeetzOrder = {
  id?: string;
  reference?: string;
  status?: string;
  currency?: string;
  language?: string;
  customerId?: string | number;
  createdAt?: string;
  updatedAt?: string;
  items?: { tickets?: Json[]; retails?: Json[]; vouchers?: Json[]; memberships?: Json[] };
  [key: string]: unknown;
};

export type LineInput = {
  kind: 'TICKET' | 'RETAIL' | 'VOUCHER' | 'MEMBERSHIP';
  itemName: string;
  priceName: string | null;
  priceValue: number | null;
  quantity: number;
  itemStatus: string | null;
  optionId: string | null;
  availabilityId: string | null;
  unitId: string | null;
  barcode: string | null;
  qrCode: string | null;
  voucherCode: string | null;
  voucherStatus: string | null;
  membershipCode: string | null;
  membershipStatus: string | null;
  guestFirstName: string | null;
  guestLastName: string | null;
};

const EMPTY: Omit<LineInput, 'kind' | 'itemName'> = {
  priceName: null,
  priceValue: null,
  quantity: 1,
  itemStatus: null,
  optionId: null,
  availabilityId: null,
  unitId: null,
  barcode: null,
  qrCode: null,
  voucherCode: null,
  voucherStatus: null,
  membershipCode: null,
  membershipStatus: null,
  guestFirstName: null,
  guestLastName: null,
};

/**
 * Smeetz types these fields as strings, but asks integrators never to rely on that - a membership unit's id has shown up as
 * a raw integer. Everything is coerced, so one unexpected type costs a line's value, not the rest of a run.
 */
const str = (v: unknown): string | null => (v === undefined || v === null ? null : String(v));
const list = (v: unknown): Json[] => (Array.isArray(v) ? (v as Json[]) : []);
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});

/** One order's tickets, retail items, vouchers and memberships as flat lines, one per unit. */
export function flattenLines(order: RawSmeetzOrder): LineInput[] {
  const lines: LineInput[] = [];

  for (const t of list(order.items?.tickets)) {
    const itemName = str(t.optionName) ?? '(unnamed option)';
    for (const u of list(t.units)) {
      lines.push({
        ...EMPTY,
        kind: 'TICKET',
        itemName,
        priceName: str(t.priceName),
        priceValue: typeof u.priceValue === 'number' ? u.priceValue : null,
        itemStatus: str(u.itemStatus),
        optionId: str(t.optionId),
        availabilityId: str(u.availabilityId),
        unitId: str(u.id),
        barcode: str(u.barcode),
        qrCode: str(u.token), // the same value as the one-order call's tickets[].qrCode
        guestFirstName: str(obj(u.guest).firstName),
        guestLastName: str(obj(u.guest).lastName),
      });
    }
  }

  for (const r of list(order.items?.retails)) {
    lines.push({
      ...EMPTY,
      kind: 'RETAIL',
      itemName: str(r.retailName) ?? '(unnamed item)',
      quantity: typeof r.quantity === 'number' ? r.quantity : 1,
      itemStatus: str(r.itemStatus),
    });
  }

  for (const v of list(order.items?.vouchers)) {
    const itemName = str(v.name) ?? '(unnamed voucher)';
    const units = list(v.units);
    if (units.length === 0) lines.push({ ...EMPTY, kind: 'VOUCHER', itemName });
    for (const u of units) {
      lines.push({ ...EMPTY, kind: 'VOUCHER', itemName, itemStatus: str(u.itemStatus), unitId: str(u.id), voucherCode: str(u.code), voucherStatus: str(u.voucherStatus) });
    }
  }

  for (const m of list(order.items?.memberships)) {
    const base = { ...EMPTY, kind: 'MEMBERSHIP' as const, itemName: str(m.optionName) ?? '(unnamed membership)', priceName: str(m.priceName), optionId: str(m.optionId) };
    const units = list(m.units);
    if (units.length === 0) lines.push(base);
    for (const u of units) {
      lines.push({ ...base, itemStatus: str(u.itemStatus), unitId: str(u.id), membershipCode: str(u.membershipCode), membershipStatus: str(u.membershipStatus) });
    }
  }

  return lines;
}

// ------------------------------------------------------------ the one-order call: who bought it

export type OrderDetail = {
  customer: { name: string | null; company: string | null; email: string | null; phone: string | null; address: string | null };
  /** Each ticket's QR payload, keyed by the ticket unit's id. */
  tickets: { uuid: string; qrCode: string | null }[];
};

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null);

/** Reads GET /v1/order/{id} tolerantly. Null if it is not the shape expected at all. */
export function parseOrderDetail(body: unknown): OrderDetail | null {
  const data = obj(obj(body).data);
  const c = data.customer && typeof data.customer === 'object' ? (data.customer as Json) : null;
  if (!c) return null;
  const name = [text(c.firstName), text(c.lastName)].filter(Boolean).join(' ') || null;
  // street, city, postcode, country - whatever of them Smeetz has
  const address = [text(c.address), text(c.city), text(c.zipCode), text(c.country)].filter(Boolean).join(', ') || null;
  const tickets = list(data.tickets).flatMap((t) => {
    const uuid = text(t.uuid);
    return uuid ? [{ uuid, qrCode: text(t.qrCode) }] : [];
  });
  return { customer: { name, company: text(c.company), email: text(c.email), phone: text(c.phone), address }, tickets };
}
