import { Global, Module } from '@nestjs/common';
import { PushService } from './push.service.js';
import { FcmService } from './fcm.service.js';
import { PushController } from './push.controller.js';

@Global()
@Module({
  controllers: [PushController],
  providers: [PushService, FcmService],
  exports: [PushService],
})
export class NotificationsModule {}
