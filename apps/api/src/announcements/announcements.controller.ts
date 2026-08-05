import { Body, Controller, Get, Post, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { createAnnouncementSchema, REALTIME_EVENTS } from '@kynren/shared';
import type { CreateAnnouncementInput } from '@kynren/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { PushService } from '../notifications/push.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { Public, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/guards.js';

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
      });
    }
    return announcement;
  }
}
