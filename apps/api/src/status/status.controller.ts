import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StatusService } from './status.service.js';
import { RequirePermission } from '../common/decorators.js';
import { PermissionsGuard } from '../common/guards.js';

/** System status board — health of every service, with 90-day uptime history. */
@ApiTags('status')
@ApiBearerAuth()
@Controller('admin/status')
@RequirePermission('system')
@UseGuards(PermissionsGuard)
export class StatusController {
  constructor(private readonly status: StatusService) {}

  @Get()
  get() {
    return this.status.getStatus();
  }

  @Post('check')
  check() {
    return this.status.runChecks();
  }

  @Patch('settings')
  setInterval(@Body() b: { intervalMinutes?: number }) {
    return this.status.setIntervalMinutes(Number(b?.intervalMinutes) || 60);
  }
}
