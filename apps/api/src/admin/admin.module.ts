import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { ManageController } from './manage.controller.js';

@Module({ controllers: [AdminController, ManageController] })
export class AdminModule {}
