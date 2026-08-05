import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { REALTIME_EVENTS } from '@kynren/shared';
import type { CreateOrderInput, OrderStatusValue } from '@kynren/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { PushService } from '../notifications/push.service.js';

@Injectable()
export class FoodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushService,
  ) {}

  listRestaurants() {
    return this.prisma.restaurant.findMany({
      where: { active: true },
      include: { menuItems: { where: { available: true } }, poi: true },
    });
  }

  async createOrder(userId: string, input: CreateOrderInput) {
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: input.items.map((i) => i.menuItemId) }, restaurantId: input.restaurantId, available: true },
    });
    const priceMap = new Map(menuItems.map((m) => [m.id, m.priceCents]));
    if (priceMap.size !== new Set(input.items.map((i) => i.menuItemId)).size) {
      throw new BadRequestException('One or more items are unavailable');
    }

    let total = 0;
    const items = input.items.map((i) => {
      const price = priceMap.get(i.menuItemId)!;
      total += price * i.quantity;
      return { menuItemId: i.menuItemId, quantity: i.quantity, priceCents: price };
    });

    return this.prisma.order.create({
      data: {
        userId,
        restaurantId: input.restaurantId,
        pickupSlot: new Date(input.pickupSlot),
        totalCents: total,
        items: { create: items },
      },
      include: { items: { include: { menuItem: true } }, restaurant: true },
    });
  }

  listMyOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { menuItem: true } }, restaurant: true },
    });
  }

  /** Kitchen queue for staff (FNB). */
  listForRestaurant(restaurantId: string) {
    return this.prisma.order.findMany({
      where: { restaurantId, status: { in: ['PENDING', 'PREPARING', 'READY'] } },
      orderBy: { pickupSlot: 'asc' },
      include: { items: { include: { menuItem: true } } },
    });
  }

  async updateStatus(orderId: string, status: OrderStatusValue) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { restaurant: true } });
    if (!order) throw new NotFoundException('Order not found');

    const updated = await this.prisma.order.update({ where: { id: orderId }, data: { status } });
    this.realtime.emit(REALTIME_EVENTS.orderUpdated, { id: orderId, status });

    if (status === 'READY') {
      await this.push.sendToUsers(
        [order.userId],
        'Your order is ready 🍽️',
        `Collect from ${order.restaurant.name} when you're ready.`,
        { type: 'order', orderId },
      );
    }
    return updated;
  }
}
