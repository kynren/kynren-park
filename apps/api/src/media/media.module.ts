import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MediaController } from './media.controller.js';
import { HostUploadedMedia } from './media.interceptor.js';
import { MediaService } from './media.service.js';

@Module({
  controllers: [MediaController],
  providers: [MediaService, { provide: APP_INTERCEPTOR, useClass: HostUploadedMedia }],
  exports: [MediaService],
})
export class MediaModule {}
