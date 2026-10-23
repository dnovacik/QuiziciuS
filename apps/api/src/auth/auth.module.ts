import { Module } from '@nestjs/common';
import { RolesGuard } from './require-role';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Module({
  providers: [SupabaseAuthGuard, RolesGuard],
  exports: [SupabaseAuthGuard, RolesGuard],
})
export class AuthModule {}
