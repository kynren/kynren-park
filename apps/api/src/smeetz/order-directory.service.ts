import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmeetzReadClient } from './smeetz-read.client.js';
import { SMEETZ_ORDER_ID } from './smeetz-config.js';
import { normaliseEmail, parseOrderDetail, toGuestOrder, type GuestBuyer, type GuestOrder } from './order-shape.js';

const MAX_ORDERS = 50;

/**
 * Who bought what, from the local mirror of Smeetz's orders and the buyer index beside it. This is what an emailed code is
 * checked against: an address's orders are found here, with no call to Smeetz.
 */
@Injectable()
export class SmeetzOrderDirectory {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smeetz: SmeetzReadClient,
  ) {}

  /** Every order bought with an email address, plus who the buyer is. Exact address only. */
  async lookup(rawEmail: string): Promise<{ orders: GuestOrder[]; buyer: GuestBuyer | null }> {
    const email = normaliseEmail(rawEmail);
    if (!email) return { orders: [], buyer: null };

    const bought = await this.prisma.smeetzBuyer.findMany({ where: { email }, orderBy: { readAt: 'desc' }, take: 200 });
    if (bought.length === 0) return { orders: [], buyer: null };
    const orderIds = bought.map((b) => b.orderId);

    // One Smeetz customer is one buyer: their other orders are theirs too, even where only one of them was read.
    const own = await this.prisma.smeetzOrder.findMany({ where: { id: { in: orderIds } }, select: { customerId: true } });
    const customerIds = [...new Set(own.map((o) => o.customerId).filter((id): id is string => Boolean(id)))];

    const rows = await this.prisma.smeetzOrder.findMany({
      where: { OR: [{ id: { in: orderIds } }, ...(customerIds.length ? [{ customerId: { in: customerIds } }] : [])] },
      include: { lines: true },
      orderBy: { smeetzCreatedAt: 'desc' },
      take: MAX_ORDERS,
    });

    // The most recently read order with a value wins; any of them may be missing.
    const pick = (get: (b: (typeof bought)[number]) => string | null) => bought.map(get).find((v) => v && v.trim())?.trim() ?? null;
    const buyer: GuestBuyer = { name: pick((b) => b.name), phone: pick((b) => b.phone), address: pick((b) => b.address) };
    return { orders: rows.map((r) => toGuestOrder(r)), buyer };
  }

  async ordersForEmail(email: string): Promise<GuestOrder[]> {
    return (await this.lookup(email)).orders;
  }

  /**
   * A buyer's address is only on Smeetz's one-order call, and the buyers already indexed were read before the address was
   * kept. So when a guest's own details are asked for and there is no address on file, read their newest order once and keep
   * what it says (an empty string records "looked, none there", so it is not asked again).
   */
  async fillAddress(rawEmail: string): Promise<void> {
    const email = normaliseEmail(rawEmail);
    if (!email) return;
    const rows = await this.prisma.smeetzBuyer.findMany({ where: { email }, orderBy: { readAt: 'desc' }, take: 200 });
    if (rows.length === 0 || rows.some((r) => r.address !== null)) return;
    const target = rows.find((r) => SMEETZ_ORDER_ID.test(r.orderId));
    if (!target) return;
    const result = await this.smeetz.get<unknown>('api', `/v1/order/${target.orderId}`, { locale: 'en' });
    if (!result.ok) return;
    const detail = parseOrderDetail(result.data);
    if (!detail) return;
    await this.prisma.smeetzBuyer.update({ where: { orderId: target.orderId }, data: { address: detail.customer.address ?? '' } });
  }

  /** Remembers who bought an order, so it is never read from Smeetz again. */
  async rememberBuyer(orderId: string, buyer: { name?: string | null; email?: string | null; company?: string | null; phone?: string | null; address?: string | null } | null): Promise<void> {
    const data = {
      email: normaliseEmail(buyer?.email) || null,
      name: buyer?.name ?? null,
      company: buyer?.company ?? null,
      phone: buyer?.phone ?? null,
      address: buyer ? (buyer.address ?? '') : null,
      readAt: new Date(),
    };
    await this.prisma.smeetzBuyer.upsert({ where: { orderId }, create: { orderId, ...data }, update: data });
  }
}
