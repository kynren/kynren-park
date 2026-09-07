import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
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
import { BrandingModule } from './branding/branding.module.js';
import { UsersModule } from './users/users.module.js';
import { AdminModule } from './admin/admin.module.js';
import { StatusModule } from './status/status.module.js';
import { HealthController } from './health/health.controller.js';
import { JwtAuthGuard } from './common/guards.js';

@Module({
  imports: [
    // Global JWT so guards can verify tokens everywhere.
    JwtModule.register({ global: true }),
    // Base rate limit for every route (generous — this is abuse/DoS
    // protection, not a normal-usage throttle). Auth endpoints override
    // this with a much tighter limit — see auth.controller.ts's @Throttle().
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
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
    BrandingModule,
    UsersModule,
    AdminModule,
    StatusModule,
  ],
  controllers: [HealthController],
  providers: [
    // Rate limiting runs before auth so it protects login/register too
    // (an unauthenticated attacker is exactly who needs limiting there).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Auth guard runs on every route; endpoints opt out with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
