import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

export interface GuestTicket {
  barcode: string | null;
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

/**
 * The groups app keeps the customer index (who bought each Smeetz order) because Smeetz cannot be searched by email.
 * This asks it, over the internal Docker network, for the orders bought with one address. The groups app refuses
 * anything without the shared secret or anything that came through the public proxy.
 */
@Injectable()
export class GroupsOrdersClient {
  private readonly logger = new Logger(GroupsOrdersClient.name);
  private readonly baseUrl = (process.env.GROUPS_LOOKUP_URL || 'http://kynren-groups:3000').replace(/\/+$/, '');
  private readonly secret = process.env.GROUPS_LOOKUP_SECRET || '';

  get configured() {
    return this.secret.length >= 24;
  }

  async ordersForEmail(email: string): Promise<GuestOrder[]> {
    if (!this.configured) throw new ServiceUnavailableException('Booking lookup is not configured');
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/internal/smeetz-orders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.secret}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (e) {
      this.logger.error(`Groups lookup unreachable: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Booking lookup is temporarily unavailable');
    }
    if (!res.ok) {
      this.logger.error(`Groups lookup answered ${res.status}`);
      throw new ServiceUnavailableException('Booking lookup is temporarily unavailable');
    }
    const body = (await res.json().catch(() => null)) as { orders?: GuestOrder[] } | null;
    return Array.isArray(body?.orders) ? body.orders : [];
  }
}
