import { BadRequestException, Body, Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service.js';
import { SmeetzService } from './smeetz.service.js';
import { SmeetzEmailLinkService } from './smeetz-email-link.service.js';
import { CurrentUser } from '../common/decorators.js';
import type { AuthPrincipal } from '../common/decorators.js';

function guestId(user: AuthPrincipal): string {
  if (user.type !== 'user') throw new ForbiddenException('Guests only');
  return user.sub;
}

/**
 * Guest-facing wallet link for tickets bought through Smeetz's own checkout (outside this app). Additive only —
 * doesn't touch the existing in-app Booking/Ticket flow at all.
 */
@ApiTags('smeetz')
@ApiBearerAuth()
@Controller('smeetz')
export class SmeetzController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smeetz: SmeetzService,
    private readonly emailLink: SmeetzEmailLinkService,
  ) {}

  @Post('link')
  async link(@CurrentUser() user: AuthPrincipal, @Body() body: { reference?: string }) {
    const userId = guestId(user);
    const reference = body?.reference?.trim();
    if (!reference) throw new BadRequestException('reference is required');

    // Verify the reference actually resolves to a real Smeetz order before
    // saving it — no point linking a typo.
    const order = await this.smeetz.getOrderByReference(reference).catch(() => null);
    if (!order) throw new BadRequestException('No Smeetz order found for that reference');

    await this.prisma.smeetzLinkedOrder.upsert({
      where: { userId_orderReference: { userId, orderReference: reference } },
      create: { userId, orderReference: reference },
      update: {},
    });
    return order;
  }

  /** Asks for a code to be emailed. Answers the same way whether or not the address has any bookings. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('email/request')
  async requestCode(@CurrentUser() user: AuthPrincipal, @Body() body: { email?: string }) {
    await this.emailLink.requestCode(guestId(user), String(body?.email ?? ''));
    return { ok: true };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('email/verify')
  async verifyCode(@CurrentUser() user: AuthPrincipal, @Body() body: { email?: string; code?: string }) {
    return this.emailLink.verify(guestId(user), String(body?.email ?? ''), String(body?.code ?? ''));
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  async refresh(@CurrentUser() user: AuthPrincipal) {
    return this.emailLink.refresh(guestId(user));
  }

  /** Who the booking system says this guest is (name, phone, address), for the addresses they have proved they own. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('profile')
  async profile(@CurrentUser() user: AuthPrincipal) {
    return this.emailLink.profile(guestId(user));
  }

  @Get('my-orders')
  async myOrders(@CurrentUser() user: AuthPrincipal) {
    const userId = guestId(user);
    const linked = await this.prisma.smeetzLinkedOrder.findMany({
      where: { userId },
      orderBy: { linkedAt: 'desc' },
    });
    return Promise.all(
      linked.map(async (l) => {
        // Orders linked by a verified email carry what the customer index held when they were last looked up;
        // ones linked by reference are read from Smeetz as before.
        const order =
          l.source === 'email'
            ? (l.snapshot as Record<string, unknown> | null)
            : await this.smeetz.getOrderByReference(l.orderReference).catch(() => null);
        return { reference: l.orderReference, source: l.source, linkedAt: l.linkedAt, order };
      }),
    );
  }
}
