import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { hostEmbedded, mediaId, mediaUrl, type ParsedDataUrl } from './media.logic.js';

/** Keeps the park's pictures and clips as hosted files, so what is saved and synced is a short URL, not the file itself. */
@Injectable()
export class MediaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Stores a file (once, however many times it is sent) and returns the id it is served under. */
  async store(file: ParsedDataUrl): Promise<string> {
    const id = mediaId(file.bytes);
    await this.prisma.mediaFile.upsert({
      where: { id },
      create: { id, mime: file.mime, data: new Uint8Array(file.bytes), size: file.bytes.length }, // a copy: Prisma wants a plain ArrayBuffer-backed array
      update: {},
    });
    return id;
  }

  /** The same value with every embedded picture replaced by its hosted URL. [base] is where the API is reached from outside. */
  async hostEmbedded<T>(value: T, base: string): Promise<[T, boolean]> {
    const [out, changed] = await hostEmbedded(value, async (file) => mediaUrl(base, await this.store(file)));
    return [out as T, changed];
  }
}
