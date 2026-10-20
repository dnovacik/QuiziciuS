import { Test } from '@nestjs/testing';

// Stub required environment variables before importing AppModule
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
process.env.TEAM_TOKEN_SECRET = 'team-token-secret';

import { AppModule } from './app.module';

describe('AppModule', () => {
  it('compiles', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(moduleRef).toBeDefined();
  });
});
