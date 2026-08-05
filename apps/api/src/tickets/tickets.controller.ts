import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { createBookingSchema, validateTicketSchema } from '@kynren/shared';
import type { CreateBookingInput } from '@kynren/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser, Public, Roles } from '../common/decorators.js';
import type { AuthPrincipal } from '../common/decorators.js';
import { RolesGuard } from '../common/guards.js';
import { TicketsService } from './tickets.service.js';

@ApiTags('tickets')
@Controller()
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Public()
  @Get('ticket-types')
  ticketTypes() {
    return this.tickets.ticketTypes();
  }

  @ApiBearerAuth()
  @Post('bookings')
  createBooking(
    @CurrentUser() user: AuthPrincipal,
    @Body(new ZodValidationPipe(createBookingSchema)) body: CreateBookingInput,
  ) {
    return this.tickets.createBooking(user.sub, body);
  }

  @ApiBearerAuth()
  @Get('bookings')
  listBookings(@CurrentUser() user: AuthPrincipal) {
    return this.tickets.listBookings(user.sub);
  }

  @ApiBearerAuth()
  @Get('bookings/:id')
  getBooking(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.tickets.getBooking(user.sub, id);
  }

  /** Staff scanner endpoint. */
  @ApiBearerAuth()
  @Roles('OPS')
  @UseGuards(RolesGuard)
  @Post('tickets/validate')
  validate(@Body(new ZodValidationPipe(validateTicketSchema)) body: { qrToken: string }) {
    return this.tickets.validate(body.qrToken);
  }
}
