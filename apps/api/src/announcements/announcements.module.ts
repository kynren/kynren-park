import { Module } from '@nestjs/common';
import { AnnouncementsController } from './announcements.controller.js';

@Module({ controllers: [AnnouncementsController] })
export class AnnouncementsModule {}
