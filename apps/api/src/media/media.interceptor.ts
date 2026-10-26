import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { MediaService } from './media.service.js';

/**
 * Whatever staff save, a picture that arrives as an embedded `data:` URL is stored as a hosted file and replaced by its
 * URL before the save happens. The admin keeps sending what it always sent; the database and the sync bundle only ever
 * hold short links. (Guests' own requests are left alone.)
 */
@Injectable()
export class HostUploadedMedia implements NestInterceptor {
  constructor(private readonly media: MediaService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const req = ctx.switchToHttp().getRequest();
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.user?.type === 'staff' && req.body && typeof req.body === 'object') {
      // where the outside world reaches this API: behind the proxy that is the public site; locally it is the API itself
      const base = process.env.PUBLIC_MEDIA_URL || `${req.protocol}://${req.get('host')}`;
      const [body, changed] = await this.media.hostEmbedded(req.body, base);
      if (changed) req.body = body;
    }
    return next.handle();
  }
}
