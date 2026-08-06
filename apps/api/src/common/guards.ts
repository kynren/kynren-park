import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PUBLIC_KEY, ROLES_KEY, PERMISSION_KEY } from './decorators.js';
import type { AuthPrincipal } from './decorators.js';
import { PermissionsService } from '../permissions/permissions.service.js';

function extractToken(req: any): string | null {
  const header = req.headers?.authorization as string | undefined;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

/** Verifies the access token and attaches `req.user`. Honours @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest();
    const token = extractToken(req);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Missing bearer token');
    }
    try {
      const payload = this.jwt.verify<AuthPrincipal>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      req.user = payload;
      return true;
    } catch {
      if (isPublic) return true; // optional auth: ignore a bad token
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}

/** Requires the principal to be staff with one of the @Roles(). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const user = ctx.switchToHttp().getRequest().user as AuthPrincipal | undefined;
    if (!user || user.type !== 'staff') throw new ForbiddenException('Staff access required');
    // ADMIN can do anything.
    if (user.role === 'ADMIN') return true;
    if (!user.role || !roles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}

/** Requires the staff member's role to hold the @RequirePermission() permission. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!permission) return true;

    const user = ctx.switchToHttp().getRequest().user as AuthPrincipal | undefined;
    if (!user || user.type !== 'staff') throw new ForbiddenException('Staff access required');
    if (user.role === 'ADMIN') return true;
    if (!(await this.permissions.can(user.role, permission))) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
    return true;
  }
}
