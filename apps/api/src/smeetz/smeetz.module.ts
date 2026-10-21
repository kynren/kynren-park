import { Module } from '@nestjs/common';
import { SmeetzController } from './smeetz.controller.js';
import { AdminSmeetzController } from './admin-smeetz.controller.js';
import { SmeetzService } from './smeetz.service.js';
import { SmeetzEmailLinkService } from './smeetz-email-link.service.js';
import { GroupsOrdersClient } from './groups-orders.client.js';

@Module({
  controllers: [SmeetzController, AdminSmeetzController],
  providers: [SmeetzService, SmeetzEmailLinkService, GroupsOrdersClient],
  exports: [SmeetzService],
})
export class SmeetzModule {}
