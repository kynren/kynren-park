import { Module } from '@nestjs/common';
import { ScheduleModule } from '../schedule/schedule.module.js';
import { ItineraryService } from './itinerary.service.js';
import { ItineraryController } from './itinerary.controller.js';
import { ItineraryRemindersService } from './itinerary-reminders.service.js';

@Module({
  imports: [ScheduleModule],
  providers: [ItineraryService, ItineraryRemindersService],
  controllers: [ItineraryController],
})
export class ItineraryModule {}
