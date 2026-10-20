import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

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

    // `authHost`, not `host` — Express's real Request already defines a
    // getter-only `req.host` (deprecated alias for req.hostname), and
    // assigning to it throws on a real request object.
    req.authHost = { id: data.user.id };
    return true;
  }
}
