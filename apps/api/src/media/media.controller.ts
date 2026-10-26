import { Controller, Get, NotFoundException, Param, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MEDIA_ID, parseRange } from './media.logic.js';

/** Serves the hosted pictures and clips. A file's id is a hash of its bytes, so it can be cached for good. */
@ApiExcludeController()
@Controller('media')
export class MediaController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipThrottle() // a screen of pictures is dozens of requests at once
  @Get(':id')
  async file(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
    if (!MEDIA_ID.test(id)) throw new NotFoundException();
    const etag = `"${id}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // pictures are used by the admin and by apps from other origins, and read onto a canvas to find the walkways
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // an uploaded SVG opened on its own must not be able to run anything on the site's origin
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    // the same id is always the same bytes, so a match needs no lookup at all
    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }
    const row = await this.prisma.mediaFile.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    const bytes = Buffer.from(row.data);
    res.setHeader('Content-Type', row.mime);
    const range = parseRange(req.headers.range, bytes.length);
    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${bytes.length}`);
      res.setHeader('Content-Length', String(range.end - range.start + 1));
      res.end(bytes.subarray(range.start, range.end + 1));
      return;
    }
    res.setHeader('Content-Length', String(bytes.length));
    res.end(bytes);
  }
}
