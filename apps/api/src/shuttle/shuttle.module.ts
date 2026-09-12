import { Module } from '@nestjs/common';
import { ShuttleController } from './shuttle.controller.js';
import { AdminShuttleController } from './admin-shuttle.controller.js';

@Module({ controllers: [ShuttleController, AdminShuttleController] })
export class ShuttleModule {}
