import { Injectable, Logger } from '@nestjs/common';

interface SmeetzListResponse<T> {
  data: T;
  meta?: unknown;
  error: unknown;
}

/**
 * Thin wrapper around the Smeetz ticketing API (server-side only — the API
 * key must never reach the mobile client). Two API families are covered:
 *  - the real-time REST API (products/availability/external orders/access
 *    control), all currently BETA per Smeetz's own docs;
 *  - the Data API (customers/orders/order sessions) for reporting.
 *
 * SMEETZ_API_KEY in this deployment is a PRODUCTION key — see .env. Callers
 * must treat createOrder/addUnitItem/setCustomer/completeOrder and
 * recordTicketAccess as real, mutating operations against live Smeetz data.
 */
@Injectable()
export class SmeetzService {
  private readonly logger = new Logger(SmeetzService.name);
  private readonly baseUrl = process.env.SMEETZ_API_URL || 'https://services.test.smeetz.com';
  private readonly apiKey = process.env.SMEETZ_API_KEY || '';

  private async request<T>(
    path: string,
    init: { method?: string; query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    if (!this.apiKey) throw new Error('SMEETZ_API_KEY is not configured');
    const url = new URL(path, this.baseUrl);
    for (const [k, v] of Object.entries(init.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    const res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: {
        'x-public-api-key': this.apiKey,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    const text = await res.text();
    let json: unknown = undefined;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      // Non-JSON response — fall through with json left undefined.
    }
    if (!res.ok) {
      this.logger.error(`Smeetz ${init.method ?? 'GET'} ${path} → ${res.status}: ${text.slice(0, 500)}`);
      throw new Error(`Smeetz request failed (${res.status})`);
    }
    return json as T;
  }

  /** Health probe for the admin "test connection" action. */
  async healthCheck(): Promise<{ ok: boolean; detail: string }> {
    try {
      await this.getProducts({ page_size: 1 });
      return { ok: true, detail: 'Smeetz API reachable.' };
    } catch (e) {
      return { ok: false, detail: (e as Error).message };
    }
  }

  // ---- Real-time REST API (BETA per Smeetz docs) ---------------------------

  getProducts(query: Record<string, string | number | undefined> = {}) {
    return this.request<SmeetzListResponse<unknown[]>>('/public/v1/products', { query });
  }

  getAvailability(query: { option_ids: string; date_from?: string; date_to?: string; locale?: string }) {
    return this.request<SmeetzListResponse<unknown[]>>('/public/v1/availability', { query });
  }

  /** Look up a Smeetz order by its customer-facing reference code. */
  getOrderByReference(orderReference: string) {
    return this.request<unknown>(`/v1/orders/public/reference/${encodeURIComponent(orderReference)}`);
  }

  /** Mutating. Creates a new order session against the live Smeetz account. */
  createOrder(body: { language: string; currency?: string; shopperId?: string; holdToken?: string }) {
    return this.request<{ id: string; sessionId: string } & Record<string, unknown>>('/v1/external/orders', {
      method: 'POST',
      body,
    });
  }

  /** Mutating. Adds a ticket unit to an in-progress order. */
  addUnitItem(orderId: string, body: Record<string, unknown>) {
    return this.request<unknown>(`/v1/external/orders/${encodeURIComponent(orderId)}/unit-item`, {
      method: 'POST',
      body,
    });
  }

  /** Mutating. Attaches customer details to an in-progress order. */
  setCustomer(
    orderId: string,
    body: { sessionId: string; customer: { firstName: string; lastName: string; email: string; [k: string]: unknown } },
  ) {
    return this.request<unknown>(`/v1/external/orders/${encodeURIComponent(orderId)}/customer`, {
      method: 'PUT',
      body,
    });
  }

  /** Mutating. Finalizes an order after payment has been taken. */
  completeOrder(orderId: string, body: { sessionId: string }) {
    return this.request<unknown>(`/v1/external/orders/${encodeURIComponent(orderId)}/complete`, {
      method: 'POST',
      body,
    });
  }

  // ---- Access control (gate scanning) ---------------------------------------

  /** Mutating. Dry-run check — verify without recording an actual gate pass. */
  checkTicketAccess(body: { groupId: string; barCode: string; areaCode: string }) {
    return this.request<unknown>('/v1/public/access-control/ticket/check-access', { method: 'POST', body });
  }

  /** Mutating. Records a real gate scan against the live Smeetz account. */
  recordTicketAccess(body: {
    groupId: string;
    barCode: string;
    areaCode: string;
    forcedAccess?: boolean;
    userId?: string;
    operationReference?: string;
  }) {
    return this.request<unknown>('/v1/public/access-control/ticket/record-access', { method: 'POST', body });
  }

  // ---- Data API (reporting) --------------------------------------------------

  getCustomers(query: { page_size?: number; page?: number; date_from?: string; date_to?: string } = {}) {
    return this.request<SmeetzListResponse<unknown[]>>('/public/v3/customers', { query });
  }

  getOrders(query: { page_size?: number; page?: number; date_from?: string; date_to?: string } = {}) {
    return this.request<SmeetzListResponse<unknown[]>>('/v1/orders', { query });
  }

  getOrderSessions(query: { page_size?: number; page?: number } = {}) {
    return this.request<SmeetzListResponse<unknown[]>>('/v1/orders/sessions', { query });
  }
}
