import { Module } from '@nestjs/common';
import { AttractionsController } from './attractions.controller.js';

@Module({ controllers: [AttractionsController] })
export class AttractionsModule {}
