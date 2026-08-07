import { Module } from '@nestjs/common';
import { StatusService } from './status.service.js';
import { StatusController } from './status.controller.js';

// MailService, PushService and RealtimeGateway come from @Global modules.
@Module({
  controllers: [StatusController],
  providers: [StatusService],
})
export class StatusModule {}
