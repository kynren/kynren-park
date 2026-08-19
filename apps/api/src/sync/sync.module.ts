import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller.js';
import { ScheduleModule } from '../schedule/schedule.module.js';

@Module({ imports: [ScheduleModule], controllers: [SyncController] })
export class SyncModule {}
