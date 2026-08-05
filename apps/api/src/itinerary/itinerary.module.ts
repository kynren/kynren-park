import { Module } from '@nestjs/common';
import { ItineraryService } from './itinerary.service.js';
import { ItineraryController } from './itinerary.controller.js';

@Module({
  providers: [ItineraryService],
  controllers: [ItineraryController],
})
export class ItineraryModule {}
