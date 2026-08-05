import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import type { CreateBookingInput } from '@kynren/shared';
import { PrismaService } from '../prisma/prisma.service.js';

function bookingRef() {
  return 'KYN-' + randomBytes(4).toString('hex').toUpperCase();
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  ticketTypes() {
    return this.prisma.ticketType.findMany({ where: { onSale: true } });
  }

  async createBooking(userId: string, input: CreateBookingInput) {
    const typeIds = input.items.map((i) => i.ticketTypeId);
    const types = await this.prisma.ticketType.findMany({ where: { id: { in: typeIds } } });
    const typeMap = new Map(types.map((t) => [t.id, t]));
    if (typeMap.size !== new Set(typeIds).size) throw new BadRequestException('Unknown ticket type');

    let total = 0;
    const ticketRows: { ticketTypeId: string; qrToken: string }[] = [];
    for (const item of input.items) {
      const type = typeMap.get(item.ticketTypeId)!;
      total += type.priceCents * item.quantity;
      for (let n = 0; n < item.quantity; n++) {
        ticketRows.push({ ticketTypeId: type.id, qrToken: '' }); // token set after id known
      }
    }

    const booking = await this.prisma.booking.create({
      data: {
        reference: bookingRef(),
        userId,
        visitDate: new Date(`${input.visitDate}T00:00:00.000Z`),
        totalCents: total,
        tickets: { create: ticketRows.map((r) => ({ ticketTypeId: r.ticketTypeId, qrToken: randomBytes(8).toString('hex') })) },
      },
      include: { tickets: true },
    });

    // Replace placeholder tokens with signed, self-verifying QR payloads.
    await Promise.all(
      booking.tickets.map((t) =>
        this.prisma.ticket.update({
          where: { id: t.id },
          data: { qrToken: this.signTicket(t.id, booking.reference) },
        }),
      ),
    );

    return this.getBooking(userId, booking.id);
  }

  private signTicket(ticketId: string, reference: string) {
    return this.jwt.sign(
      { tid: ticketId, ref: reference },
      { secret: process.env.TICKET_QR_SECRET, expiresIn: '400d' },
    );
  }

  getBooking(userId: string, id: string) {
    return this.prisma.booking.findFirst({
      where: { id, userId },
      include: { tickets: { include: { ticketType: true } } },
    });
  }

  listBookings(userId: string) {
    return this.prisma.booking.findMany({
      where: { userId },
      orderBy: { visitDate: 'desc' },
      include: { tickets: { include: { ticketType: true } } },
    });
  }

  /** Staff scan: verify signature, then mark used (single-use). */
  async validate(qrToken: string) {
    let decoded: { tid: string; ref: string };
    try {
      decoded = this.jwt.verify(qrToken, { secret: process.env.TICKET_QR_SECRET });
    } catch {
      return { valid: false, reason: 'Invalid or tampered ticket' };
    }
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: decoded.tid },
      include: { ticketType: true, booking: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.status === 'CANCELLED' || ticket.status === 'REFUNDED') {
      return { valid: false, reason: `Ticket ${ticket.status.toLowerCase()}` };
    }
    if (ticket.status === 'USED') {
      return { valid: false, reason: `Already scanned at ${ticket.usedAt?.toISOString()}` };
    }
    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: 'USED', usedAt: new Date() },
    });
    return {
      valid: true,
      ticketType: ticket.ticketType.name,
      reference: ticket.booking.reference,
      visitDate: ticket.booking.visitDate.toISOString().slice(0, 10),
    };
  }
}
