import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InMemoryProfilesRepository } from '../test-utils/in-memory-repositories';
import { SupabaseService } from '../supabase/supabase.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';

function contextFor(req: Record<string, unknown>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
}

function supabaseReturning(user: { id: string } | null): SupabaseService {
  return {
    getClient: () => ({
      auth: { getUser: async () => (user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'invalid' } }) },
    }),
  } as unknown as SupabaseService;
}

describe('SupabaseAuthGuard', () => {
  it('rejects a request with no authorization header', async () => {
    const guard = new SupabaseAuthGuard(supabaseReturning(null), new InMemoryProfilesRepository());
    await expect(guard.canActivate(contextFor({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    const guard = new SupabaseAuthGuard(supabaseReturning(null), new InMemoryProfilesRepository());
    await expect(guard.canActivate(contextFor({ headers: { authorization: 'Bearer bad' } }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the account with its role from the profiles table', async () => {
    const profiles = new InMemoryProfilesRepository();
    profiles.add('host-1', 'HOST');
    await profiles.update('host-1', { deactivated_at: '2026-10-01T00:00:00Z', subscription_forever: true });
    const guard = new SupabaseAuthGuard(supabaseReturning({ id: 'host-1' }), profiles);
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer good' } };

    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(req.authHost).toEqual({
      id: 'host-1',
      role: 'HOST',
      deactivated: true,
      subscription: { status: 'FOREVER', until: null, forever: true },
    });
  });

  it('treats an account without a profile as a team captain', async () => {
    const guard = new SupabaseAuthGuard(supabaseReturning({ id: 'new-user' }), new InMemoryProfilesRepository());
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer good' } };

    await guard.canActivate(contextFor(req));
    expect(req.authHost).toEqual({ id: 'new-user', role: 'TEAM_CAPTAIN', deactivated: false, subscription: null });
  });
});
