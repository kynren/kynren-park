import { Module } from '@nestjs/common';
import { ItineraryService } from './itinerary.service.js';
import { ItineraryController } from './itinerary.controller.js';
import { ItineraryRemindersService } from './itinerary-reminders.service.js';

@Module({
  providers: [ItineraryService, ItineraryRemindersService],
  controllers: [ItineraryController],
})
export class ItineraryModule {}
