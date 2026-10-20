import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';

function contextWithHeader(header?: string): ExecutionContext {
  const req: Record<string, unknown> = { headers: header ? { authorization: header } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('SupabaseAuthGuard', () => {
  it('rejects a request with no authorization header', async () => {
    const supabase = { getClient: () => ({}) } as unknown as SupabaseService;
    const guard = new SupabaseAuthGuard(supabase);

    await expect(guard.canActivate(contextWithHeader())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    const supabase = {
      getClient: () => ({
        auth: { getUser: async () => ({ data: { user: null }, error: { message: 'invalid' } }) },
      }),
    } as unknown as SupabaseService;
    const guard = new SupabaseAuthGuard(supabase);

    await expect(guard.canActivate(contextWithHeader('Bearer bad-token'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches host to the request on a valid token', async () => {
    const supabase = {
      getClient: () => ({
        auth: { getUser: async () => ({ data: { user: { id: 'host-1' } }, error: null }) },
      }),
    } as unknown as SupabaseService;
    const guard = new SupabaseAuthGuard(supabase);
    const req: Record<string, unknown> = { headers: { authorization: 'Bearer good-token' } };
    const context = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(req.authHost).toEqual({ id: 'host-1' });
  });
});
