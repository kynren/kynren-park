import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmeetzService } from './smeetz.service.js';
import { CurrentUser } from '../common/decorators.js';
import type { AuthPrincipal } from '../common/decorators.js';

/**
 * Guest-facing wallet link for tickets bought through Smeetz's own checkout
 * (outside this app). Additive only — doesn't touch the existing in-app
 * Booking/Ticket flow at all.
 */
@ApiTags('smeetz')
@ApiBearerAuth()
@Controller('smeetz')
export class SmeetzController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smeetz: SmeetzService,
  ) {}

  @Post('link')
  async link(@CurrentUser() user: AuthPrincipal, @Body() body: { reference?: string }) {
    const reference = body?.reference?.trim();
    if (!reference) throw new BadRequestException('reference is required');

    // Verify the reference actually resolves to a real Smeetz order before
    // saving it — no point linking a typo.
    const order = await this.smeetz.getOrderByReference(reference).catch(() => null);
    if (!order) throw new BadRequestException('No Smeetz order found for that reference');

    await this.prisma.smeetzLinkedOrder.upsert({
      where: { userId_orderReference: { userId: user.sub, orderReference: reference } },
      create: { userId: user.sub, orderReference: reference },
      update: {},
    });
    return order;
  }

  @Get('my-orders')
  async myOrders(@CurrentUser() user: AuthPrincipal) {
    const linked = await this.prisma.smeetzLinkedOrder.findMany({
      where: { userId: user.sub },
      orderBy: { linkedAt: 'desc' },
    });
    const orders = await Promise.all(
      linked.map(async (l) => {
        const order = await this.smeetz.getOrderByReference(l.orderReference).catch(() => null);
        return { reference: l.orderReference, linkedAt: l.linkedAt, order };
      }),
    );
    return orders;
  }
}
