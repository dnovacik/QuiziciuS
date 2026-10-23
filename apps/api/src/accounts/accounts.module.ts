import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountsController, AdminController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AdminTeamsService } from './admin-teams.service';
import { AuthAdminGateway, SupabaseAuthAdminGateway } from './auth-admin.gateway';

/** The signed-in account (GET /me) and the super-admin area (hosts, team moderation). */
@Module({
  imports: [AuthModule],
  controllers: [AccountsController, AdminController],
  providers: [AccountsService, AdminTeamsService, { provide: AuthAdminGateway, useClass: SupabaseAuthAdminGateway }],
})
export class AccountsModule {}
