import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  it('builds a client from config values', () => {
    const config = {
      getOrThrow: (key: string) =>
        ({
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        })[key],
    } as unknown as ConfigService;

    const service = new SupabaseService(config);

    expect(service.getClient()).toBeDefined();
    expect(typeof service.getClient().from).toBe('function');
  });
});
