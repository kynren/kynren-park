import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TicketsService } from './tickets.service.js';
import { TicketsController } from './tickets.controller.js';

@Module({
  imports: [JwtModule.register({})],
  providers: [TicketsService],
  controllers: [TicketsController],
})
export class TicketsModule {}
