import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { subscriptionOf } from '../accounts/subscription';
import { ProfilesRepository } from '../data/profiles.repository';
import { SupabaseService } from '../supabase/supabase.service';
import { CurrentHostPayload } from './current-host.decorator';

/** Verifies the Supabase session and attaches the account (id, role, deactivated, subscription) to the request. */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly profiles: ProfilesRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing host token');
    }

    const token = header.slice('Bearer '.length);
    const { data, error } = await this.supabase.getClient().auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid host session');
    }

    // The role comes from our own profiles table, never from user_metadata (users can edit that).
    // A missing profile row means the lowest level.
    const profile = await this.profiles.findById(data.user.id);
    const account: CurrentHostPayload = {
      id: data.user.id,
      role: profile?.role ?? 'TEAM_CAPTAIN',
      deactivated: Boolean(profile?.deactivated_at),
      subscription: profile ? subscriptionOf(profile) : null,
    };

    // `authHost`, not `host` — Express's real Request already defines a
    // getter-only `req.host` (deprecated alias for req.hostname), and
    // assigning to it throws on a real request object.
    req.authHost = account;
    return true;
  }
}
