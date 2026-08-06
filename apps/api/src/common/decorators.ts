import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export interface AuthPrincipal {
  sub: string;
  type: 'user' | 'staff';
  role?: string;
  email?: string | null;
}

/** Injects the authenticated principal attached by the auth guards. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal | undefined => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);

export const ROLES_KEY = 'roles';
/** Restrict a staff endpoint to the given roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const PUBLIC_KEY = 'isPublic';
/** Marks a route as accessible without authentication. */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

export const PERMISSION_KEY = 'permission';
/** Require the staff member's role to hold a permission (per the role matrix). */
export const RequirePermission = (permission: string) => SetMetadata(PERMISSION_KEY, permission);
