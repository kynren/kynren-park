import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SmeetzService } from './smeetz.service.js';
import { Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/guards.js';

/** Admin "test connection" action for the System → API Connection page. */
@ApiTags('admin-smeetz')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('admin/smeetz')
export class AdminSmeetzController {
  constructor(private readonly smeetz: SmeetzService) {}

  @Get('status')
  status() {
    return this.smeetz.healthCheck();
  }
}
