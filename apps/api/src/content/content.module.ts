import { Module } from '@nestjs/common';
import { ContentController } from './content.controller.js';

@Module({ controllers: [ContentController] })
export class ContentModule {}
