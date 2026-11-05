import { Module } from '@nestjs/common';
import { LocationRetentionService } from './location-retention.service.js';
import { UsersController } from './users.controller.js';

@Module({ controllers: [UsersController], providers: [LocationRetentionService] })
export class UsersModule {}
