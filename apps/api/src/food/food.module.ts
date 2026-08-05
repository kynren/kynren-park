import { Module } from '@nestjs/common';
import { FoodService } from './food.service.js';
import { FoodController } from './food.controller.js';

@Module({
  providers: [FoodService],
  controllers: [FoodController],
})
export class FoodModule {}
