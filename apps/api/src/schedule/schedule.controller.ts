import { Body, Controller, Get, Param, Patch, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { updateSessionStatusSchema } from '@kynren/shared';
import type { UpdateSessionStatusInput } from '@kynren/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { ScheduleService } from './schedule.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { Public, RequirePermission } from '../common/decorators.js';
import { PermissionsGuard } from '../common/guards.js';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

@ApiTags('schedule')
@Controller('schedule')
export class ScheduleController {
  constructor(
    private readonly schedule: ScheduleService,
    private readonly prisma: PrismaService,
  ) {}

  /** Live schedule for a given date (defaults to today). Public. */
  @Public()
  @Get()
  byDate(@Query('date') date?: string) {
    return this.schedule.byDate(date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayStr());
  }

  /** Staff: change a session's live status → realtime + push. */
  @ApiBearerAuth()
  @RequirePermission('schedule')
  @UseGuards(PermissionsGuard)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSessionStatusSchema)) body: UpdateSessionStatusInput,
  ) {
    return this.schedule.updateStatus(id, body);
  }
}
