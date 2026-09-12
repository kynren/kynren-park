import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../common/decorators.js';

/** Scheduled shuttle timetable — not live GPS tracking. */
@ApiTags('shuttle')
@Controller('shuttles')
export class ShuttleController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  list() {
    return this.prisma.shuttleRoute.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: { stops: { orderBy: { order: 'asc' }, include: { poi: true } } },
    });
  }
}
