import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../common/decorators.js';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  list() {
    return this.prisma.contentPage.findMany({
      where: { published: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Public()
  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.prisma.contentPage.findUnique({ where: { slug } });
  }
}
