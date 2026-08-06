import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module.js';
import { PermissionsModule } from './permissions/permissions.module.js';
import { MailModule } from './mail/mail.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AttractionsModule } from './attractions/attractions.module.js';
import { ScheduleModule } from './schedule/schedule.module.js';
import { SyncModule } from './sync/sync.module.js';
import { ItineraryModule } from './itinerary/itinerary.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { FoodModule } from './food/food.module.js';
import { AnnouncementsModule } from './announcements/announcements.module.js';
import { ContentModule } from './content/content.module.js';
import { UsersModule } from './users/users.module.js';
import { AdminModule } from './admin/admin.module.js';
import { HealthController } from './health/health.controller.js';
import { JwtAuthGuard } from './common/guards.js';

@Module({
  imports: [
    // Global JWT so guards can verify tokens everywhere.
    JwtModule.register({ global: true }),
    PrismaModule,
    PermissionsModule,
    MailModule,
    RealtimeModule,
    NotificationsModule,
    AuthModule,
    AttractionsModule,
    ScheduleModule,
    SyncModule,
    ItineraryModule,
    TicketsModule,
    FoodModule,
    AnnouncementsModule,
    ContentModule,
    UsersModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [
    // Auth guard runs on every route; endpoints opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
