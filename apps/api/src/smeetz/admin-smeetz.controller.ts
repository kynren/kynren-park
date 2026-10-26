import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SmeetzService } from './smeetz.service.js';
import { SmeetzOrderSync } from './order-sync.service.js';
import { Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/guards.js';

/** Admin "test connection" action for the System → API Connection page. */
@ApiTags('admin-smeetz')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('admin/smeetz')
export class AdminSmeetzController {
  constructor(
    private readonly smeetz: SmeetzService,
    private readonly sync: SmeetzOrderSync,
  ) {}

  @Get('status')
  status() {
    return this.smeetz.healthCheck();
  }

  /** How the local copy of Smeetz's orders is getting on: how much is held, how far it has read, what is left to read. */
  @Get('mirror')
  mirror() {
    return this.sync.status();
  }
}
