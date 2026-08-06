import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { ManageController } from './manage.controller.js';
import { SystemController } from './system.controller.js';

@Module({ controllers: [AdminController, ManageController, SystemController] })
export class AdminModule {}
