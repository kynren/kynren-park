import { Module } from '@nestjs/common';
import { SmeetzController } from './smeetz.controller.js';
import { AdminSmeetzController } from './admin-smeetz.controller.js';
import { SmeetzService } from './smeetz.service.js';

@Module({
  controllers: [SmeetzController, AdminSmeetzController],
  providers: [SmeetzService],
  exports: [SmeetzService],
})
export class SmeetzModule {}
