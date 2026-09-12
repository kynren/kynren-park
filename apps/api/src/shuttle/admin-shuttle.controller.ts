import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { RequirePermission } from '../common/decorators.js';
import { PermissionsGuard } from '../common/guards.js';

function pick<T extends Record<string, unknown>>(b: T, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (b[k] !== undefined) out[k] = b[k];
  return out;
}

@ApiTags('admin-shuttle')
@ApiBearerAuth()
@RequirePermission('content')
@UseGuards(PermissionsGuard)
@Controller('admin/shuttle-routes')
export class AdminShuttleController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.shuttleRoute.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { stops: { orderBy: { order: 'asc' } } },
    });
  }

  @Post()
  create(@Body() b: any) {
    if (!b?.name) throw new BadRequestException('name is required');
    return this.prisma.shuttleRoute.create({
      data: { name: b.name, description: b.description ?? null, active: b.active ?? true, sortOrder: b.sortOrder ?? 0 },
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() b: any) {
    const data = pick(b, ['name', 'description', 'active', 'sortOrder']);
    return this.prisma.shuttleRoute.update({ where: { id }, data });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.prisma.shuttleRoute.delete({ where: { id } });
    return { deleted: true };
  }

  // ---- Stops -----------------------------------------------------------------
  @Post(':routeId/stops')
  createStop(@Param('routeId') routeId: string, @Body() b: any) {
    if (!b?.name) throw new BadRequestException('name is required');
    return this.prisma.shuttleStop.create({
      data: {
        routeId,
        name: b.name,
        poiId: b.poiId ?? null,
        order: b.order ?? 0,
        times: Array.isArray(b.times) ? b.times : [],
      },
    });
  }

  @Patch('stops/:id')
  updateStop(@Param('id') id: string, @Body() b: any) {
    const data = pick(b, ['name', 'poiId', 'order']);
    if (Array.isArray(b.times)) data.times = b.times;
    return this.prisma.shuttleStop.update({ where: { id }, data });
  }

  @Delete('stops/:id')
  async removeStop(@Param('id') id: string) {
    await this.prisma.shuttleStop.delete({ where: { id } });
    return { deleted: true };
  }
}
