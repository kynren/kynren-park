import { Body, Controller, Get, Param, Patch, Post, UsePipes } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { registerSchema, loginSchema, refreshSchema } from '@kynren/shared';
import type { RegisterInput, LoginInput } from '@kynren/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { Public, CurrentUser } from '../common/decorators.js';
import type { AuthPrincipal } from '../common/decorators.js';
import { AuthService } from './auth.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Auth endpoints are the prime brute-force/credential-stuffing/account-spam
  // targets, so they get a much tighter limit than the app-wide default
  // (120/min, see app.module.ts) — keyed by IP like every other route.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @UsePipes(new ZodValidationPipe(registerSchema))
  register(@Body() body: RegisterInput) {
    return this.auth.register(body);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  login(@Body() body: LoginInput) {
    return this.auth.login(body);
  }

  @Public()
  @Post('refresh')
  @UsePipes(new ZodValidationPipe(refreshSchema))
  refresh(@Body() body: { refreshToken: string }) {
    return this.auth.refresh(body.refreshToken);
  }

  @Public()
  @Post('logout')
  @UsePipes(new ZodValidationPipe(refreshSchema))
  logout(@Body() body: { refreshToken: string }) {
    return this.auth.logout(body.refreshToken);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('staff/login')
  @UsePipes(new ZodValidationPipe(loginSchema))
  staffLogin(@Body() body: LoginInput) {
    return this.auth.staffLogin(body);
  }

  // ---- Email-invite acceptance (public) ------------------------------------
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('staff/invite/:token')
  inviteInfo(@Param('token') token: string) {
    return this.auth.inviteInfo(token);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('staff/accept-invite')
  acceptInvite(@Body() body: { token?: string; name?: string; password?: string }) {
    return this.auth.acceptInvite(body);
  }

  // ---- Signed-in staff: own account ----------------------------------------
  @ApiBearerAuth()
  @Get('staff/me')
  me(@CurrentUser() user?: AuthPrincipal) {
    return this.auth.staffMe(user);
  }

  @ApiBearerAuth()
  @Patch('staff/me')
  updateMe(@CurrentUser() user: AuthPrincipal | undefined, @Body() body: { name?: string; email?: string }) {
    return this.auth.updateStaffMe(user, body);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('staff/me/password')
  changePassword(@CurrentUser() user: AuthPrincipal | undefined, @Body() body: { currentPassword?: string; newPassword?: string }) {
    return this.auth.changeStaffPassword(user, body);
  }
}
