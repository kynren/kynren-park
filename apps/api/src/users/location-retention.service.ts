import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/** A guest's last known position is only kept for the visit: after this it is cleared, so the privacy policy can say so. */
export const LOCATION_KEEP_HOURS = 6;
const SWEEP_MS = 15 * 60_000;

/**
 * The park's live "who is here" view only needs where a guest was in the last 45 minutes, so a position older than a
 * visit has no use and is wiped (coordinates and the time they were seen), a sweep every quarter of an hour. The same
 * OnModuleInit setInterval pattern as StatusService: no cron or queue dependency for one sweep.
 */
@Injectable()
export class LocationRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LocationRetentionService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.sweep().catch((e) => this.logger.error(e)); // anything that went stale while the API was down
    this.timer = setInterval(() => this.sweep().catch((e) => this.logger.error(e)), SWEEP_MS);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Clears every stored position older than the retention period. Returns how many guests it cleared. */
  async sweep(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - LOCATION_KEEP_HOURS * 3_600_000);
    const { count } = await this.prisma.user.updateMany({
      // a position with no time to age it by counts as stale too
      where: { OR: [{ lastSeenAt: { lt: cutoff } }, { lastSeenAt: null, OR: [{ lastLat: { not: null } }, { lastLng: { not: null } }] }] },
      data: { lastLat: null, lastLng: null, lastSeenAt: null },
    });
    if (count > 0) this.logger.log(`Cleared ${count} stored location${count === 1 ? '' : 's'} older than ${LOCATION_KEEP_HOURS} hours`);
    return count;
  }
}
