import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public, Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/guards.js';

@ApiTags('branding')
@Controller()
export class BrandingController {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreate() {
    const existing = await this.prisma.branding.findUnique({ where: { singleton: true } });
    return existing ?? this.prisma.branding.create({ data: { singleton: true } });
  }

  /** Public: the admin login page and the mobile app read branding here. */
  @Public()
  @Get('branding')
  get() {
    return this.getOrCreate();
  }

  @ApiBearerAuth()
  @Roles('ADMIN')
  @UseGuards(RolesGuard)
  @Patch('admin/branding')
  async update(@Body() b: any) {
    const cur = await this.getOrCreate();
    const data: Record<string, unknown> = {};
    for (const k of ['appName', 'tagline', 'primary', 'accent'] as const) {
      if (typeof b?.[k] === 'string' && b[k].trim()) data[k] = b[k].trim();
    }
    if (typeof b?.font === 'string' && ['system', 'serif', 'rounded', 'mono'].includes(b.font)) data.font = b.font;
    if (b?.logoUrl !== undefined) data.logoUrl = b.logoUrl || null;
    if (b?.iconUrl !== undefined) data.iconUrl = b.iconUrl || null;
    if (b?.faviconUrl !== undefined) data.faviconUrl = b.faviconUrl || null;
    if (typeof b?.splashType === 'string' && ['none', 'photo', 'gif', 'video'].includes(b.splashType)) data.splashType = b.splashType;
    if (b?.splashMediaUrl !== undefined) data.splashMediaUrl = b.splashMediaUrl || null;
    if (b?.seasonOpens !== undefined) data.seasonOpens = (typeof b.seasonOpens === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.seasonOpens)) ? b.seasonOpens : null;
    return this.prisma.branding.update({ where: { id: cur.id }, data });
  }
}
