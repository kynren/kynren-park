import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../common/decorators.js';

@ApiTags('attractions')
@Controller('attractions')
export class AttractionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  list() {
    return this.prisma.attraction.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: { poi: true },
    });
  }

  @Public()
  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    return this.prisma.attraction.findUnique({
      where: { slug },
      include: { poi: true },
    });
  }
}
