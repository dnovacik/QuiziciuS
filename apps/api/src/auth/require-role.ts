import { applyDecorators, CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountRole, hasRole } from '@quizicius/shared-types';
import { CurrentHostPayload } from './current-host.decorator';
import { SupabaseAuthGuard } from './supabase-auth.guard';

const REQUIRED_ROLE = 'requiredRole';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AccountRole | undefined>(REQUIRED_ROLE, [context.getHandler(), context.getClass()]);
    if (!required) return true;
    const account: CurrentHostPayload | undefined = context.switchToHttp().getRequest().authHost;
    if (!account || !hasRole(account.role, required)) {
      throw new ForbiddenException({ code: required === 'SUPER_ADMIN' ? 'NOT_ADMIN' : 'NOT_HOST', message: `Requires ${required}` });
    }
    return true;
  }
}

/**
 * Signed-in account with at least this role (SUPER_ADMIN ⊇ HOST ⊇ TEAM_CAPTAIN).
 * Use on a controller or a handler; a handler-level role overrides the controller's.
 */
export function RequireRole(role: AccountRole) {
  return applyDecorators(SetMetadata(REQUIRED_ROLE, role), UseGuards(SupabaseAuthGuard, RolesGuard));
}
