import { Module } from '@nestjs/common';
import { SmeetzController } from './smeetz.controller.js';
import { AdminSmeetzController } from './admin-smeetz.controller.js';
import { SmeetzService } from './smeetz.service.js';
import { SmeetzEmailLinkService } from './smeetz-email-link.service.js';
import { SmeetzReadClient } from './smeetz-read.client.js';
import { SmeetzOrderDirectory } from './order-directory.service.js';
import { SmeetzOrderSync } from './order-sync.service.js';

@Module({
  controllers: [SmeetzController, AdminSmeetzController],
  providers: [SmeetzService, SmeetzEmailLinkService, SmeetzReadClient, SmeetzOrderDirectory, SmeetzOrderSync],
  exports: [SmeetzService],
})
export class SmeetzModule {}
