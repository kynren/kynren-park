import { Body, Controller, Get, Post, Query, UsePipes } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { optimizeItinerarySchema } from '@kynren/shared';
import type { OptimizeItineraryInput } from '@kynren/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser, Public } from '../common/decorators.js';
import type { AuthPrincipal } from '../common/decorators.js';
import { ItineraryService } from './itinerary.service.js';

@ApiTags('itinerary')
@Controller('itinerary')
export class ItineraryController {
  constructor(private readonly itinerary: ItineraryService) {}

  /** Build an optimised plan without saving. Works for guests. */
  @Public()
  @Post('optimize')
  @UsePipes(new ZodValidationPipe(optimizeItinerarySchema))
  optimize(@Body() body: OptimizeItineraryInput) {
    return this.itinerary.optimize(body);
  }

  /** Persist the chosen sessions for the signed-in user. */
  @ApiBearerAuth()
  @Post()
  save(
    @CurrentUser() user: AuthPrincipal,
    @Body() body: { date: string; showSessionIds: string[] },
  ) {
    return this.itinerary.save(user.sub, body.date, body.showSessionIds ?? []);
  }

  @ApiBearerAuth()
  @Get()
  get(@CurrentUser() user: AuthPrincipal, @Query('date') date: string) {
    return this.itinerary.get(user.sub, date);
  }
}
