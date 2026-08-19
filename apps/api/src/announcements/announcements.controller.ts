import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { createAnnouncementSchema, REALTIME_EVENTS } from '@kynren/shared';
import type { CreateAnnouncementInput } from '@kynren/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { PushService } from '../notifications/push.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { Public, Roles, RequirePermission } from '../common/decorators.js';
import { RolesGuard, PermissionsGuard } from '../common/guards.js';

function pick<T extends Record<string, unknown>>(b: T, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (b[k] !== undefined) out[k] = b[k];
  return out;
}

@ApiTags('announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushService,
  ) {}

  @Public()
  @Get()
  list(@Query('date') date?: string) {
    const target = date ? new Date(`${date}T00:00:00.000Z`) : undefined;
    return this.prisma.announcement.findMany({
      where: { OR: [{ audience: 'ALL' }, ...(target ? [{ targetDate: target }] : [])] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /** Staff: publish an announcement → realtime + push. */
  @ApiBearerAuth()
  @Roles('OPS', 'CONTENT')
  @UseGuards(RolesGuard)
  @Post()
  @UsePipes(new ZodValidationPipe(createAnnouncementSchema))
  async create(@Body() body: CreateAnnouncementInput) {
    const announcement = await this.prisma.announcement.create({
      data: {
        title: body.title,
        body: body.body,
        audience: body.audience,
        targetDate: body.targetDate ? new Date(`${body.targetDate}T00:00:00.000Z`) : null,
        deepLink: body.deepLink,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        sentAt: body.scheduledAt ? null : new Date(),
      },
    });

    // Send immediately when not scheduled for later.
    if (!body.scheduledAt) {
      this.realtime.emit(REALTIME_EVENTS.announcement, announcement, body.targetDate);
      await this.push.sendToAll(announcement.title, announcement.body, {
        type: 'announcement',
        id: announcement.id,
        ...(announcement.deepLink ? { deepLink: announcement.deepLink } : {}),
      });
    }
    return announcement;
  }

  // ---- Admin management (schedule / edit / delete / resend) ------------------
  private async dispatch(a: { id: string; title: string; body: string; targetDate: Date | null; deepLink?: string | null }) {
    this.realtime.emit(REALTIME_EVENTS.announcement, a, a.targetDate?.toISOString().slice(0, 10));
    await this.push.sendToAll(a.title, a.body, {
      type: 'announcement',
      id: a.id,
      ...(a.deepLink ? { deepLink: a.deepLink } : {}),
    });
  }

  @ApiBearerAuth()
  @RequirePermission('announce')
  @UseGuards(PermissionsGuard)
  @Get('manage')
  listAll() {
    return this.prisma.announcement.findMany({ orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }], take: 200 });
  }

  @ApiBearerAuth()
  @RequirePermission('announce')
  @UseGuards(PermissionsGuard)
  @Post('manage')
  async createManaged(@Body() b: any) {
    const sendNow = !b.scheduledAt;
    const a = await this.prisma.announcement.create({
      data: {
        title: b.title,
        body: b.body,
        audience: b.audience ?? 'ALL',
        targetDate: b.targetDate ? new Date(`${b.targetDate}T00:00:00.000Z`) : null,
        deepLink: b.deepLink ?? null,
        scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : null,
        startAt: b.startAt ? new Date(b.startAt) : sendNow ? new Date() : null,
        endAt: b.endAt ? new Date(b.endAt) : null,
        recurrence: b.recurrence ?? 'none',
        sentAt: sendNow ? new Date() : null,
      },
    });
    if (sendNow) await this.dispatch(a);
    return a;
  }

  @ApiBearerAuth()
  @RequirePermission('announce')
  @UseGuards(PermissionsGuard)
  @Patch('manage/:id')
  updateManaged(@Param('id') id: string, @Body() b: any) {
    const data = pick(b, ['title', 'body', 'audience', 'deepLink', 'recurrence']);
    if (b.targetDate !== undefined) data.targetDate = b.targetDate ? new Date(`${b.targetDate}T00:00:00.000Z`) : null;
    if (b.scheduledAt !== undefined) data.scheduledAt = b.scheduledAt ? new Date(b.scheduledAt) : null;
    if (b.startAt !== undefined) data.startAt = b.startAt ? new Date(b.startAt) : null;
    if (b.endAt !== undefined) data.endAt = b.endAt ? new Date(b.endAt) : null;
    return this.prisma.announcement.update({ where: { id }, data });
  }

  @ApiBearerAuth()
  @RequirePermission('announce')
  @UseGuards(PermissionsGuard)
  @Delete('manage/:id')
  async deleteManaged(@Param('id') id: string) {
    await this.prisma.announcement.delete({ where: { id } });
    return { deleted: true };
  }

  @ApiBearerAuth()
  @RequirePermission('announce')
  @UseGuards(PermissionsGuard)
  @Post('manage/:id/resend')
  async resend(@Param('id') id: string) {
    const a = await this.prisma.announcement.update({ where: { id }, data: { sentAt: new Date(), scheduledAt: null } });
    await this.dispatch(a);
    return a;
  }
}
