import {
  Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards,
  BadRequestException, NotFoundException, ConflictException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { hashPassword } from '@kynren/shared/crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { PermissionsService, STAFF_ROLES } from '../permissions/permissions.service.js';
import { Roles } from '../common/decorators.js';
import { RolesGuard } from '../common/guards.js';

/**
 * System console: staff-account management and the role→permission matrix.
 * ADMIN only — this is the highest-privilege surface.
 */
@ApiTags('admin-system')
@ApiBearerAuth()
@Roles('ADMIN')
@UseGuards(RolesGuard)
@Controller('admin')
export class SystemController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  private view(s: { id: string; name: string; email: string; role: string; active: boolean; createdAt: Date }) {
    return { id: s.id, name: s.name, email: s.email, role: s.role, active: s.active, createdAt: s.createdAt };
  }

  private async assertNotLastAdmin(excludeId: string) {
    const admins = await this.prisma.staffUser.count({
      where: { role: 'ADMIN', active: true, NOT: { id: excludeId } },
    });
    if (admins === 0) throw new BadRequestException('There must always be at least one active admin');
  }

  // ---- Staff accounts -------------------------------------------------------
  @Get('staff')
  async listStaff() {
    const staff = await this.prisma.staffUser.findMany({ orderBy: { createdAt: 'asc' } });
    return staff.map((s) => this.view(s));
  }

  @Post('staff')
  async createStaff(@Body() b: any) {
    const email = String(b.email ?? '').trim().toLowerCase();
    const name = String(b.name ?? '').trim();
    if (!email || !name) throw new BadRequestException('Name and email are required');
    if (!STAFF_ROLES.includes(b.role)) throw new BadRequestException('Invalid role');
    if (!b.password || String(b.password).length < 8) throw new BadRequestException('Password must be at least 8 characters');
    if (await this.prisma.staffUser.findUnique({ where: { email } })) {
      throw new ConflictException('A staff member with that email already exists');
    }
    const s = await this.prisma.staffUser.create({
      data: { email, name, role: b.role, passwordHash: hashPassword(b.password), active: b.active ?? true },
    });
    return this.view(s);
  }

  @Patch('staff/:id')
  async updateStaff(@Param('id') id: string, @Body() b: any) {
    const s = await this.prisma.staffUser.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Staff not found');
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) data.name = String(b.name).trim();
    if (b.email !== undefined) {
      const email = String(b.email).trim().toLowerCase();
      if (!email) throw new BadRequestException('Email cannot be empty');
      const other = await this.prisma.staffUser.findUnique({ where: { email } });
      if (other && other.id !== id) throw new ConflictException('That email is already in use');
      data.email = email;
    }
    if (b.role !== undefined) {
      if (!STAFF_ROLES.includes(b.role)) throw new BadRequestException('Invalid role');
      if (s.role === 'ADMIN' && b.role !== 'ADMIN') await this.assertNotLastAdmin(id);
      data.role = b.role;
    }
    if (b.active !== undefined) {
      if (s.role === 'ADMIN' && b.active === false) await this.assertNotLastAdmin(id);
      data.active = !!b.active;
    }
    const updated = await this.prisma.staffUser.update({ where: { id }, data });
    return this.view(updated);
  }

  @Post('staff/:id/password')
  async resetPassword(@Param('id') id: string, @Body() b: any) {
    if (!b.password || String(b.password).length < 8) throw new BadRequestException('Password must be at least 8 characters');
    if (!(await this.prisma.staffUser.findUnique({ where: { id } }))) throw new NotFoundException('Staff not found');
    await this.prisma.staffUser.update({ where: { id }, data: { passwordHash: hashPassword(b.password) } });
    return { ok: true };
  }

  @Delete('staff/:id')
  async deleteStaff(@Param('id') id: string) {
    const s = await this.prisma.staffUser.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Staff not found');
    if (s.role === 'ADMIN') await this.assertNotLastAdmin(id);
    await this.prisma.staffUser.delete({ where: { id } });
    return { deleted: true };
  }

  // ---- Role → permission matrix --------------------------------------------
  @Get('permissions')
  getPermissions() {
    return this.permissions.getMatrix();
  }

  @Put('permissions')
  setPermissions(@Body() b: any) {
    return this.permissions.setMatrix(b?.matrix ?? b ?? {});
  }
}
